import type { OfflineExamStorage } from '../exam/offline/storage';
import { getOfflineExamStorage } from '../exam/offline/storage';
import {
  evaluateActivationGate,
  isExamBusy,
  type ActivationStorage,
} from './activationGate';
import {
  OTA_ACTIVATION_GRACE_MS,
  OTA_BOOT_HEALTH_RETRY_DELAYS_MS,
  OTA_CHANNEL,
  OTA_FOREGROUND_CHECK_INTERVAL_MS,
  OTA_INITIAL_CHECK_DELAY_MS,
  OTA_LOCAL_SCHEMA_VERSION,
  OTA_MAX_DOWNLOAD_ATTEMPTS,
  OTA_REJECT_COOLDOWN_MS,
  OTA_REQUIRE_SIGNATURE,
  OTA_RETAINED_BUNDLES,
  OTA_RETRY_BASE_MS,
  OTA_RETRY_MAX_MS,
} from './config';
import { getExamActivities } from './examActivity';
import {
  OTA_STORAGE_KEYS,
  clearBootNotice,
  clearPendingActivation,
  clearRetryState,
  clearStagedUpdate,
  createOtaKeyValue,
  readBootNotice,
  readPendingActivation,
  readRejection,
  readRetryState,
  readStagedUpdate,
  writeBootNotice,
  writePendingActivation,
  writeRejection,
  writeRetryState,
  writeStagedUpdate,
  type OtaKeyValue,
} from './persistence';
import { checkLocalDataHealth } from './schema';
import { canTransitionOta } from './stateMachine';
import type {
  ActivationDecision,
  AuthSnapshot,
  CandidateRelease,
  DownloadProgress,
  OtaBootNotice,
  OtaBlockReason,
  OtaPhase,
  OtaSnapshot,
  OtaUpdaterAdapter,
  ProviderCurrent,
  ReleaseMetadata,
  StagedUpdate,
} from './types';
import {
  compareNumericVersions,
  isHttpsUrl,
  isNativeVersionCompatible,
  isPlainChecksum,
  isSchemaVersionCompatible,
  parseReleaseVersion,
  sameChecksum,
  verifyReleaseSignature,
} from './version';

export type OtaControllerOptions = {
  adapter: OtaUpdaterAdapter;
  getAuth: () => AuthSnapshot;
  getPathname?: () => string | undefined;
  kv?: OtaKeyValue;
  storage?: ActivationStorage;
  channel?: string;
  supportedSchemaVersion?: number;
  now?: () => number;
  initialCheckDelayMs?: number;
  foregroundCheckIntervalMs?: number;
  activationGraceMs?: number;
  autoActivate?: boolean;
  /** Refuse releases that do not carry a key-v2 signature. */
  requireSignature?: boolean;
  /** Bundles to keep on disk (running + fallback). */
  retainedBundles?: number;
};

export type OtaController = {
  getSnapshot: () => OtaSnapshot;
  subscribe: (listener: (snapshot: OtaSnapshot) => void) => () => void;
  initialize: () => Promise<void>;
  checkForUpdate: (manual?: boolean) => Promise<void>;
  activate: () => Promise<ActivationDecision>;
  /** Last-resort recovery: abandon OTA bundles and run the APK's own build. */
  restoreBuiltin: () => Promise<boolean>;
  /** Reload the active provider-managed bundle without changing bundle selection. */
  reloadCurrent: () => Promise<boolean>;
  evaluateActivation: (auto?: boolean) => Promise<ActivationDecision>;
  handleForeground: () => void;
  handleOnline: () => void;
  handleAuthChange: () => void;
  handleExamActivityChange: () => void;
  dismissNotice: () => void;
  dispose: () => void;
};

const defaultSnapshot = (channel: string): OtaSnapshot => ({
  available: false,
  phase: 'disabled',
  currentVersion: null,
  builtinVersion: null,
  nativeVersion: null,
  channel,
  latestVersion: null,
  stagedVersion: null,
  activatedVersion: null,
  progress: 0,
  reasons: [],
  error: null,
  lastCheckedAt: null,
  notice: null,
  examActive: false,
});

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const clampPercent = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
};

const backoff = (attempts: number): number =>
  Math.min(OTA_RETRY_BASE_MS * 2 ** Math.max(0, attempts - 1), OTA_RETRY_MAX_MS);

/**
 * Manual, exam-safe OTA controller.
 *
 * Invariants:
 *  - Nothing is activated without passing the gate at the moment of activation.
 *  - A version is only reported as activated after the next boot confirms it
 *    and the local data schema still matches.
 *  - Downloads are verified (version + checksum) before they are persisted as
 *    staged, and staging never reloads the WebView.
 */
export const createOtaController = (
  options: OtaControllerOptions
): OtaController => {
  const adapter = options.adapter;
  const kv = options.kv ?? createOtaKeyValue();
  const storage: ActivationStorage =
    options.storage ??
    (getOfflineExamStorage() as Pick<
      OfflineExamStorage,
      'init' | 'listAttemptsForUser' | 'listPendingWork'
    >);
  const channel = options.channel ?? OTA_CHANNEL;
  const supportedSchemaVersion =
    options.supportedSchemaVersion ?? OTA_LOCAL_SCHEMA_VERSION;
  const now = options.now ?? (() => Date.now());
  const getPathname =
    options.getPathname ??
    (() =>
      typeof window === 'undefined' ? undefined : window.location.pathname);
  const initialCheckDelayMs =
    options.initialCheckDelayMs ?? OTA_INITIAL_CHECK_DELAY_MS;
  const foregroundCheckIntervalMs =
    options.foregroundCheckIntervalMs ?? OTA_FOREGROUND_CHECK_INTERVAL_MS;
  const activationGraceMs =
    options.activationGraceMs ?? OTA_ACTIVATION_GRACE_MS;
  const autoActivate = options.autoActivate ?? true;
  const requireSignature = options.requireSignature ?? OTA_REQUIRE_SIGNATURE;
  const retainedBundles = options.retainedBundles ?? OTA_RETAINED_BUNDLES;

  let snapshot = defaultSnapshot(channel);
  let staged: StagedUpdate | null = null;
  let initializedAt: number | null = null;
  let initializePromise: Promise<void> | null = null;
  let checkPromise: Promise<void> | null = null;
  let activationPromise: Promise<ActivationDecision> | null = null;
  let activationInFlight = false;
  let disposed = false;
  const listeners = new Set<(next: OtaSnapshot) => void>();
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const emit = (): void => {
    for (const listener of [...listeners]) {
      try {
        listener(snapshot);
      } catch {
        // Listener failures must not break update state handling.
      }
    }
  };

  const patch = (partial: Partial<OtaSnapshot>): void => {
    snapshot = { ...snapshot, ...partial };
    emit();
  };

  const setPhase = (phase: OtaPhase): void => {
    if (snapshot.phase === phase) return;
    if (!canTransitionOta(snapshot.phase, phase)) {
      console.warn(
        `[ota] invalid phase transition ${snapshot.phase} -> ${phase}`
      );
    }
    patch({ phase });
  };

  const scheduleTimer = (callback: () => void, delay: number): void => {
    if (disposed || delay < 0) return;
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (!disposed) callback();
    }, delay);
    timers.add(timer);
  };

  const publishNotice = (notice: OtaBootNotice): void => {
    writeBootNotice(kv, notice);
    patch({ notice });
  };

  const safeCurrent = async (): Promise<ProviderCurrent | null> => {
    try {
      return await adapter.current();
    } catch {
      return null;
    }
  };

  const readCurrentVersion = async (): Promise<string | null> => {
    const current = await safeCurrent();
    if (!current) return null;
    patch({
      currentVersion: current.bundle.version || null,
      activatedVersion: current.bundle.version || snapshot.activatedVersion,
      nativeVersion: current.native || null,
    });
    return current.bundle.version || null;
  };

  const readBuiltinVersion = async (): Promise<string | null> => {
    try {
      const builtin = await adapter.getBuiltinVersion();
      const value = builtin.trim() || null;
      patch({ builtinVersion: value });
      return value;
    } catch {
      return null;
    }
  };

  const readChannel = async (): Promise<string> => {
    try {
      const providerChannel = await adapter.getChannel();
      if (providerChannel) return providerChannel;
    } catch {
      // Fall back to the build-time channel.
    }
    return channel;
  };

  const validateMetadata = (
    metadata: ReleaseMetadata | null,
    installedNative: string | null
  ): OtaBlockReason[] => {
    const reasons: OtaBlockReason[] = [];

    if (!metadata) {
      reasons.push('metadata_invalid');
      return reasons;
    }

    if (metadata.channel !== channel) {
      reasons.push('channel_mismatch');
    }

    if (
      !isSchemaVersionCompatible(
        metadata.requiredSchemaVersion,
        supportedSchemaVersion
      )
    ) {
      reasons.push('storage_schema_incompatible');
    }

    if (!isNativeVersionCompatible(installedNative, metadata.minNativeVersion)) {
      reasons.push('native_incompatible');
    }

    return reasons;
  };

  const validateLatest = (
    latest: {
      version: string;
      url: string;
      checksum: string;
      sessionKey?: string;
      metadata: ReleaseMetadata | null;
    },
    installedNative: string | null,
    installedVersion: string | null
  ): OtaBlockReason[] => {
    const reasons = validateMetadata(latest.metadata, installedNative);

    if (!latest.url || !isHttpsUrl(latest.url)) {
      reasons.push('metadata_invalid');
    }

    if (!latest.checksum) {
      reasons.push('checksum_invalid');
    }

    /**
     * Publisher authenticity.
     *
     * The checksum in the manifest is delivered by the same endpoint as the
     * bundle, so on its own it proves only that the download was not corrupted
     * in transit. A signed release carries the RSA-encrypted checksum plus the
     * encrypted AES session key; the native layer refuses to finish a download
     * without them once a public key is present. Checking the shapes here means
     * an unsigned release is rejected before it is downloaded at all.
     */
    if (requireSignature) {
      const verdict = verifyReleaseSignature({
        checksum: latest.checksum,
        sessionKey: latest.sessionKey,
      });
      if (!verdict.ok) {
        reasons.push('unsigned_bundle');
      }
    }

    if (installedVersion && latest.metadata) {
      const installedMetadata = parseReleaseVersion(installedVersion);
      const comparison = compareNumericVersions(
        latest.metadata.baseVersion,
        installedMetadata?.baseVersion ?? installedVersion
      );
      if (comparison !== null && comparison < 0) {
        reasons.push('metadata_invalid');
      } else if (comparison === 0 && installedMetadata?.revision !== null && installedMetadata) {
        /**
         * Same base version: the release revision decides. Without this a
         * republished older revision would look like an upgrade, because the
         * version string alone differs.
         */
        const installedRevision = installedMetadata.revision ?? 0;
        const candidateRevision = latest.metadata.revision ?? 0;
        if (
          installedRevision > 0 &&
          candidateRevision > 0 &&
          candidateRevision < installedRevision
        ) {
          reasons.push('metadata_invalid');
        }
      }
    }

    return [...new Set(reasons)];
  };

  const rejectStaged = async (
    version: string,
    reasons: OtaBlockReason[]
  ): Promise<void> => {
    const bundleId = staged?.id;
    staged = null;
    clearStagedUpdate(kv);
    writeRejection(kv, {
      version,
      reasons,
      nextAt: now() + OTA_REJECT_COOLDOWN_MS,
      at: now(),
    });

    if (bundleId) {
      try {
        await adapter.deleteBundle(bundleId);
      } catch {
        // Leaving an unused bundle on disk is harmless; it is never activated.
      }
    }

    patch({
      phase: 'rejected',
      stagedVersion: null,
      progress: 0,
      reasons,
      error: reasons[0] ?? null,
    });
  };

  const recordCheckFailure = (error: unknown): void => {
    const previous = readRetryState(kv, OTA_STORAGE_KEYS.checkRetry);
    const attempts = (previous?.attempts ?? 0) + 1;
    writeRetryState(kv, OTA_STORAGE_KEYS.checkRetry, {
      key: 'check',
      attempts,
      nextAt: now() + backoff(attempts),
    });
    patch({ phase: 'check_failed', error: messageOf(error) });
  };

  const recordDownloadFailure = (version: string, error: unknown): void => {
    const previous = readRetryState(kv, OTA_STORAGE_KEYS.downloadRetry);
    const attempts =
      (previous?.key === version ? previous.attempts : 0) + 1;

    writeRetryState(kv, OTA_STORAGE_KEYS.downloadRetry, {
      key: version,
      attempts,
      nextAt:
        attempts >= OTA_MAX_DOWNLOAD_ATTEMPTS
          ? now() + OTA_REJECT_COOLDOWN_MS
          : now() + backoff(attempts),
    });

    patch({
      phase: 'download_failed',
      progress: 0,
      error: messageOf(error),
    });
  };

  const isCheckBackedOff = (): boolean => {
    const retry = readRetryState(kv, OTA_STORAGE_KEYS.checkRetry);
    return Boolean(retry && retry.nextAt > now());
  };

  const isDownloadBackedOff = (version: string): boolean => {
    const retry = readRetryState(kv, OTA_STORAGE_KEYS.downloadRetry);
    return Boolean(
      retry && retry.key === version && retry.nextAt > now()
    );
  };

  const isRejected = (version: string): boolean => {
    const rejection = readRejection(kv);
    return Boolean(
      rejection &&
        rejection.version === version &&
        rejection.nextAt > now()
    );
  };

  const downloadCandidate = async (
    candidate: CandidateRelease
  ): Promise<void> => {
    setPhase('downloading');
    patch({ progress: 0, error: null, latestVersion: candidate.version });

    const unsubscribe = adapter.subscribeProgress(
      (progress: DownloadProgress) => {
        if (progress.version && progress.version !== candidate.version) return;
        patch({ progress: clampPercent(progress.percent) });
      }
    );

    let bundle: Awaited<ReturnType<OtaUpdaterAdapter['download']>> | null = null;
    try {
      bundle = await adapter.download({
        url: candidate.url,
        version: candidate.version,
        checksum: candidate.checksum,
        sessionKey: candidate.sessionKey,
      });
    } catch (error) {
      recordDownloadFailure(candidate.version, error);
      return;
    } finally {
      unsubscribe();
    }

    if (!bundle || bundle.status !== 'success' || bundle.version !== candidate.version) {
      if (bundle?.id) {
        try {
          await adapter.deleteBundle(bundle.id);
        } catch {
          // Best effort cleanup.
        }
      }
      recordDownloadFailure(
        candidate.version,
        new Error('Downloaded bundle is incomplete or has the wrong version')
      );
      return;
    }

    /**
     * The plugin reports the SHA-256 it computed over the *extracted* bundle.
     *
     * For a signed release the manifest checksum is an RSA block that the native
     * download already decrypted and compared before extracting; comparing that
     * block with a local digest would reject every correctly signed release.
     * So: always require a real digest locally, and only compare it with the
     * manifest when the release is unsigned.
     */
    const localChecksum = (bundle.checksum ?? '').trim().toLowerCase();

    if (!isPlainChecksum(localChecksum)) {
      try {
        await adapter.deleteBundle(bundle.id);
      } catch {
        // Best effort cleanup.
      }
      await rejectCandidate(candidate.version, ['checksum_invalid']);
      return;
    }

    if (!requireSignature && !sameChecksum(localChecksum, candidate.checksum)) {
      try {
        await adapter.deleteBundle(bundle.id);
      } catch {
        // Best effort cleanup.
      }
      await rejectCandidate(candidate.version, ['checksum_invalid']);
      return;
    }

    try {
      const bundles = await adapter.list();
      const listed = bundles.find((item) => item.id === bundle?.id);
      if (
        !listed ||
        listed.status !== 'success' ||
        listed.version !== candidate.version ||
        (listed.checksum && !sameChecksum(listed.checksum, localChecksum))
      ) {
        await adapter.deleteBundle(bundle.id);
        recordDownloadFailure(
          candidate.version,
          new Error('Downloaded bundle did not pass the installed-bundle check')
        );
        return;
      }
    } catch {
      // list() is a defence-in-depth check; download() success is authoritative.
    }

    const nextStaged: StagedUpdate = {
      id: bundle.id,
      version: candidate.version,
      checksum: localChecksum,
      manifestChecksum: candidate.checksum,
      metadata: candidate.metadata,
      stagedAt: now(),
      signed: requireSignature,
    };

    staged = nextStaged;
    writeStagedUpdate(kv, nextStaged);
    clearRetryState(kv, OTA_STORAGE_KEYS.downloadRetry);
    patch({
      stagedVersion: nextStaged.version,
      progress: 100,
      error: null,
    });
    setPhase('staged');
    await evaluateActivation(false);
  };

  const rejectCandidate = async (
    version: string,
    reasons: OtaBlockReason[]
  ): Promise<void> => {
    writeRejection(kv, {
      version,
      reasons,
      nextAt: now() + OTA_REJECT_COOLDOWN_MS,
      at: now(),
    });
    patch({
      phase: 'rejected',
      reasons,
      error: reasons[0] ?? null,
    });
  };

  const performCheck = async (): Promise<void> => {
    setPhase('checking');
    patch({ error: null });

    const current = await safeCurrent();
    const installedVersion = current?.bundle.version || null;
    const installedNative =
      current?.native || (await readBuiltinVersion());
    const providerChannel = await readChannel();

    patch({
      currentVersion: installedVersion,
      builtinVersion: installedNative,
      nativeVersion: current?.native || null,
      channel: providerChannel,
    });

    if (providerChannel !== channel) {
      patch({
        phase: 'rejected',
        reasons: ['channel_mismatch'],
        error: 'This device is pointed at a different update channel',
      });
      return;
    }

    let latest;
    try {
      latest = await adapter.getLatest();
    } catch (error) {
      recordCheckFailure(error);
      return;
    }

    if (latest.kind === 'up_to_date' || latest.error === 'no_new_version_available') {
      clearRetryState(kv, OTA_STORAGE_KEYS.checkRetry);
      patch({ lastCheckedAt: now(), error: null });
      setPhase('up_to_date');
      return;
    }

    if (latest.kind === 'blocked') {
      clearRetryState(kv, OTA_STORAGE_KEYS.checkRetry);
      patch({
        phase: 'rejected',
        reasons: ['channel_mismatch'],
        error: latest.error || 'The update server blocked this check',
        lastCheckedAt: now(),
      });
      return;
    }

    if (latest.kind === 'failed' || latest.error) {
      recordCheckFailure(
        new Error(latest.error || 'The update server returned no version')
      );
      return;
    }

    if (!latest.version) {
      recordCheckFailure(new Error('The update server returned no version'));
      return;
    }

    clearRetryState(kv, OTA_STORAGE_KEYS.checkRetry);
    patch({ latestVersion: latest.version, lastCheckedAt: now() });

    if (installedVersion && latest.version === installedVersion) {
      setPhase('up_to_date');
      return;
    }

    const metadata = parseReleaseVersion(latest.version);
    const reasons = validateLatest(
      { ...latest, metadata },
      installedNative,
      installedVersion
    );

    if (!metadata || reasons.length > 0) {
      await rejectCandidate(
        latest.version,
        reasons.length > 0 ? reasons : ['metadata_invalid']
      );
      return;
    }

    const candidate: CandidateRelease = {
      version: latest.version,
      url: latest.url,
      checksum: latest.checksum,
      sessionKey: latest.sessionKey,
      metadata,
      signatureRequired: requireSignature,
    };

    if (isRejected(latest.version)) {
      patch({
        phase: 'rejected',
        reasons: readRejection(kv)?.reasons ?? [],
        error: 'This version was rejected recently',
      });
      return;
    }

    if (isDownloadBackedOff(latest.version)) {
      patch({
        phase: 'download_failed',
        error: 'Waiting before retrying this download',
      });
      return;
    }

    if (staged && staged.version === latest.version) {
      await evaluateActivation(false);
      return;
    }

    setPhase('available');
    await downloadCandidate(candidate);
  };

  const verifyStagedBundle = async (
    candidate: StagedUpdate
  ): Promise<OtaBlockReason[]> => {
    let bundles;
    try {
      bundles = await adapter.list();
    } catch {
      return ['plugin_unavailable'];
    }

    const listed = bundles.find((bundle) => bundle.id === candidate.id);
    if (
      !listed ||
      listed.status !== 'success' ||
      listed.version !== candidate.version ||
      !listed.checksum ||
      !sameChecksum(listed.checksum, candidate.checksum)
    ) {
      return ['checksum_invalid'];
    }

    return [];
  };

  const performActivation = async (): Promise<ActivationDecision> => {
    if (!staged) {
      return { allowed: false, reasons: [] };
    }

    const current = await safeCurrent();
    const installedNative =
      current?.native || (await readBuiltinVersion());
    const metadataReasons = validateMetadata(staged.metadata, installedNative);

    if (metadataReasons.length > 0) {
      await rejectStaged(staged.version, metadataReasons);
      return { allowed: false, reasons: metadataReasons };
    }

    const bundleReasons = await verifyStagedBundle(staged);
    if (bundleReasons.length > 0) {
      if (bundleReasons.includes('plugin_unavailable')) {
        patch({ reasons: bundleReasons });
        setPhase('activation_blocked');
        return { allowed: false, reasons: bundleReasons };
      }
      await rejectStaged(staged.version, bundleReasons);
      return { allowed: false, reasons: bundleReasons };
    }

    const health = await checkLocalDataHealth(
      storage,
      kv,
      supportedSchemaVersion
    );
    const gate = await evaluateActivationGate({
      auth: options.getAuth(),
      storage,
      activities: getExamActivities(),
      pathname: getPathname(),
    });

    const reasons = [
      ...new Set<OtaBlockReason>([
        ...gate.reasons,
        ...(health.ok ? [] : [health.reason]),
        ...(kv.durable === false ? ['storage_unavailable' as const] : []),
      ]),
    ];
    const examActive = isExamBusy(getExamActivities(), getPathname());

    patch({ reasons, examActive });

    if (reasons.length > 0) {
      setPhase('activation_blocked');
      return { allowed: false, reasons };
    }

    setPhase('staged');
    return { allowed: true, reasons: [] };
  };

  const evaluateActivation = (
    auto = false
  ): Promise<ActivationDecision> => {
    if (activationPromise) return activationPromise;

    const run = async (): Promise<ActivationDecision> => {
      const decision = await performActivation();
      if (
        decision.allowed &&
        auto &&
        autoActivate &&
        staged &&
        initializedAt !== null &&
        now() - initializedAt >= activationGraceMs &&
        !isExamBusy(getExamActivities(), getPathname())
      ) {
        await applyActivation();
      }
      return decision;
    };

    activationPromise = run().finally(() => {
      activationPromise = null;
    });

    return activationPromise;
  };

  const applyActivation = async (): Promise<boolean> => {
    if (!staged || activationInFlight || snapshot.phase === 'activating') return false;

    activationInFlight = true;
    const candidate = staged;
    setPhase('activating');
    patch({ error: null });

    writePendingActivation(kv, {
      id: candidate.id,
      version: candidate.version,
      previousVersion: snapshot.currentVersion ?? '',
      startedAt: now(),
    });

    const persistedPending = readPendingActivation(kv);
    if (!persistedPending || persistedPending.id !== candidate.id) {
      activationInFlight = false;
      patch({
        error: 'Could not persist the activation marker',
        reasons: ['storage_unavailable'],
      });
      setPhase('staged');
      return false;
    }

    try {
      // set() normally reloads the WebView immediately; code after it is not
      // reliable on device, which is why the success is confirmed next boot.
      await adapter.setBundle(candidate.id);
    } catch (error) {
      clearPendingActivation(kv);
      patch({ error: messageOf(error), reasons: ['activation_not_applied'] });
      setPhase('staged');
      return false;
    } finally {
      activationInFlight = false;
    }

    return true;
  };

  const activate = async (): Promise<ActivationDecision> => {
    const decision = await evaluateActivation(false);
    if (!decision.allowed) return decision;

    const current = await safeCurrent();
    const installedNative = current?.native || (await readBuiltinVersion());
    const metadataReasons = staged
      ? validateMetadata(staged.metadata, installedNative)
      : ['metadata_invalid' as OtaBlockReason];

    if (metadataReasons.length > 0) {
      if (staged) await rejectStaged(staged.version, metadataReasons);
      return { allowed: false, reasons: metadataReasons };
    }

    const gate = await evaluateActivationGate({
      auth: options.getAuth(),
      storage,
      activities: getExamActivities(),
      pathname: getPathname(),
    });
    if (!gate.allowed) {
      patch({ reasons: gate.reasons, examActive: true });
      setPhase('activation_blocked');
      return gate;
    }

    const applied = await applyActivation();
    return applied
      ? { allowed: true, reasons: [] }
      : {
          allowed: false,
          reasons: snapshot.reasons.length > 0
            ? snapshot.reasons
            : ['activation_not_applied'],
        };
  };

  /**
   * Drop every OTA bundle and run the build that ships inside the APK.
   *
   * This is the escape hatch for a downloaded bundle that is broken but never
   * failed the boot check. It is never automatic: the user asks for it. Local
   * exam data lives in IndexedDB and is not part of any bundle, so switching
   * bundles cannot lose it.
   */
  const restoreBuiltin = async (): Promise<boolean> => {
    if (!adapter.resetToBuiltin) return false;

    staged = null;
    clearStagedUpdate(kv);
    clearPendingActivation(kv);

    try {
      // reset() reloads the WebView; code after it is not reliable on device.
      await adapter.resetToBuiltin();
      return true;
    } catch (error) {
      patch({ error: messageOf(error) });
      return false;
    }
  };

  const reloadCurrent = async (): Promise<boolean> => {
    if (!snapshot.available) return false;
    if (isExamBusy(getExamActivities(), getPathname())) return false;
    await adapter.reload();
    return true;
  };

  /**
   * Read local-data health, retrying only what can plausibly change.
   *
   * A WebView that cannot open IndexedDB *yet* (restore, low memory, another
   * connection still closing) is not evidence that the new bundle broke
   * storage. A version mismatch is: no amount of retrying fixes it.
   */
  const readHealthWithRetry = async (): Promise<
    Awaited<ReturnType<typeof checkLocalDataHealth>>
  > => {
    let health = await checkLocalDataHealth(
      storage,
      kv,
      supportedSchemaVersion
    );

    const delays = OTA_BOOT_HEALTH_RETRY_DELAYS_MS;
    for (let attempt = 0; attempt < delays.length && !health.ok && health.transient; attempt += 1) {
      const wait = delays[attempt];
      if (wait > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, wait));
      }
      health = await checkLocalDataHealth(storage, kv, supportedSchemaVersion);
    }

    return health;
  };

  /**
   * Keep disk usage bounded without losing the rollback target.
   *
   * The plugin used to delete the previous bundle as soon as the new one was
   * confirmed, which left no local fallback for a regression discovered after
   * boot. `autoDeletePrevious` is now off and retention is decided here: the
   * running bundle plus the newest other successful bundle survive; failed
   * bundles and anything older are removed.
   */
  const pruneBundles = async (currentId: string | null): Promise<string[]> => {
    try {
      const bundles = await adapter.list();
      const deleted: string[] = [];

      const others = bundles.filter(
        (bundle) =>
          bundle.id !== currentId &&
          bundle.id !== 'builtin' &&
          bundle.builtin !== true &&
          bundle.status !== 'downloading' &&
          bundle.status !== 'pending'
      );

      // Failed bundles never occupy a retention slot: they are deleted below
      // regardless, so counting them here would prune a usable fallback.
      const byRecency = others
        .filter((bundle) => bundle.status !== 'error')
        .sort((a, b) => {
          const left = Date.parse(a.downloadedAt ?? '') || 0;
          const right = Date.parse(b.downloadedAt ?? '') || 0;
          return right - left;
        });

      const retainable = Math.max(0, retainedBundles - 1);
      const keep = new Set(
        byRecency.slice(0, retainable).map((bundle) => bundle.id)
      );

      for (const bundle of others) {
        const failed = bundle.status === 'error';
        if (!failed && keep.has(bundle.id)) continue;
        try {
          await adapter.deleteBundle(bundle.id);
          deleted.push(bundle.id);
        } catch {
          // A bundle that refuses to delete is harmless; retried next boot.
        }
      }

      return deleted;
    } catch {
      return [];
    }
  };

  const confirmBoot = async (): Promise<void> => {
    const pending = readPendingActivation(kv);
    const health = await readHealthWithRetry();

    if (!health.ok) {
      // Surface the condition even when it does not block anything, so the UI
      // can explain why updates stay paused.
      patch({ reasons: [health.reason], error: health.detail ?? null });
    }

    if (!pending) {
      /**
       * No activation is pending, so this bundle is the one that was already
       * running. Withholding `notifyAppReady` here would only ask the plugin to
       * roll back to another bundle that faces the same database.
       */
      try {
        await adapter.notifyAppReady();
      } catch {
        // The web runtime has no native app-ready handshake.
      }
      void pruneBundles((await safeCurrent())?.bundle.id ?? null);
      return;
    }

    const current = await safeCurrent();
    const matches = current?.bundle.version === pending.version;

    if (matches && health.ok) {
      try {
        await adapter.notifyAppReady();
      } catch {
        // The plugin may already have been notified in this session.
      }

      clearPendingActivation(kv);
      if (staged?.version === pending.version) {
        staged = null;
        clearStagedUpdate(kv);
      }
      patch({
        phase: 'activated',
        currentVersion: current?.bundle.version ?? pending.version,
        activatedVersion: pending.version,
        stagedVersion: null,
        progress: 0,
        reasons: [],
        error: null,
        lastCheckedAt: now(),
      });
      publishNotice({
        phase: 'activated',
        version: pending.version,
        at: now(),
      });
      void pruneBundles(current?.bundle.id ?? pending.id);
      return;
    }

    /**
     * A transient storage outage is not proof that the bundle is broken.
     * Rolling back would delete a good update on the strength of one flaky
     * boot, so the bundle is confirmed and the condition is reported instead.
     */
    if (matches && !health.ok && health.transient) {
      try {
        await adapter.notifyAppReady();
      } catch {
        // Ignore a missing handshake.
      }

      clearPendingActivation(kv);
      if (staged?.version === pending.version) {
        staged = null;
        clearStagedUpdate(kv);
      }
      patch({
        phase: 'activated',
        currentVersion: current?.bundle.version ?? pending.version,
        activatedVersion: pending.version,
        stagedVersion: null,
        reasons: [health.reason],
        error: health.detail ?? 'local storage was temporarily unavailable',
      });
      publishNotice({
        phase: 'activated',
        version: pending.version,
        reasons: [health.reason],
        at: now(),
      });
      void pruneBundles(current?.bundle.id ?? pending.id);
      return;
    }

    if (matches && !health.ok) {
      clearPendingActivation(kv);
      const failedBundle = staged;
      staged = null;
      clearStagedUpdate(kv);
      writeRejection(kv, {
        version: pending.version,
        reasons: [health.reason],
        nextAt: now() + OTA_REJECT_COOLDOWN_MS,
        at: now(),
      });

      if (failedBundle) {
        try {
          await adapter.deleteBundle(failedBundle.id);
        } catch {
          // Best effort.
        }
      }

      patch({
        phase: 'recovery',
        stagedVersion: null,
        reasons: [health.reason],
        error: `Update ${pending.version} failed the local data check`,
      });
      publishNotice({
        phase: 'recovery',
        version: pending.version,
        reasons: [health.reason],
        at: now(),
      });

      // Do not call notifyAppReady: rolling back to the previous bundle is the
      // intended recovery for an update that broke local data access.
      try {
        await adapter.resetToLastSuccessful();
        await adapter.reload();
      } catch (error) {
        patch({ error: messageOf(error) });
      }
      return;
    }

    // The pending bundle is not running: either Capgo rolled it back after a
    // failed boot, or set() never took effect. Confirm the current bundle so
    // the app does not get rolled back again, and cool down the bad version.
    try {
      await adapter.notifyAppReady();
    } catch {
      // Ignore a missing handshake.
    }

    clearPendingActivation(kv);
    clearStagedUpdate(kv);
    staged = null;
    writeRejection(kv, {
      version: pending.version,
      reasons: ['activation_not_applied'],
      nextAt: now() + OTA_REJECT_COOLDOWN_MS,
      at: now(),
    });

    patch({
      phase: 'activation_failed',
      stagedVersion: null,
      currentVersion: current?.bundle.version ?? snapshot.currentVersion,
      activatedVersion: current?.bundle.version ?? snapshot.activatedVersion,
      reasons: ['activation_not_applied'],
      error: `Update ${pending.version} is not running`,
    });
    publishNotice({
      phase: 'activation_failed',
      version: pending.version,
      reasons: ['activation_not_applied'],
      at: now(),
    });
  };

  const doInitialize = async (): Promise<void> => {
    let available = false;
    try {
      available = await adapter.isAvailable();
    } catch {
      available = false;
    }

    if (disposed) return;

    if (!available) {
      patch({ available: false, phase: 'disabled' });
      return;
    }

    initializedAt = now();
    patch({ available: true, phase: 'idle' });

    const previousNotice = readBootNotice(kv);
    if (previousNotice) {
      clearBootNotice(kv);
      patch({ notice: previousNotice });
    }

    await readCurrentVersion();
    await readBuiltinVersion();
    const providerChannel = await readChannel();
    patch({ channel: providerChannel });

    staged = readStagedUpdate(kv);
    if (staged) {
      patch({ stagedVersion: staged.version });
    }

    await confirmBoot();

    if (staged) {
      await evaluateActivation(false);
      return;
    }

    scheduleTimer(() => {
      void checkForUpdate(false);
    }, initialCheckDelayMs);
  };

  const initialize = (): Promise<void> => {
    if (!initializePromise) {
      initializePromise = doInitialize().catch((error) => {
        patch({ error: messageOf(error) });
      });
    }
    return initializePromise;
  };

  const checkForUpdate = async (manual = false): Promise<void> => {
    if (checkPromise) return checkPromise;
    if (disposed || !snapshot.available || snapshot.phase === 'disabled') {
      return;
    }
    if (snapshot.phase === 'activating') return;

    if (!manual) {
      if (staged) {
        await evaluateActivation(false);
        return;
      }
      if (isExamBusy(getExamActivities(), getPathname())) return;
      if (isCheckBackedOff()) return;
    }

    checkPromise = performCheck()
      .catch((error) => {
        recordCheckFailure(error);
      })
      .finally(() => {
        checkPromise = null;
      });

    return checkPromise;
  };

  const handleForeground = (): void => {
    if (disposed || !snapshot.available) return;

    if (staged) {
      void evaluateActivation(true);
      return;
    }

    const lastCheck = snapshot.lastCheckedAt;
    if (
      lastCheck === null ||
      now() - lastCheck >= foregroundCheckIntervalMs
    ) {
      void checkForUpdate(false);
    }
  };

  const handleOnline = (): void => {
    if (disposed || !snapshot.available) return;
    void checkForUpdate(false);
  };

  const handleAuthChange = (): void => {
    if (!snapshot.available) return;
    patch({ examActive: isExamBusy(getExamActivities(), getPathname()) });
    if (staged) void evaluateActivation(false);
  };

  const handleExamActivityChange = (): void => {
    if (!snapshot.available) return;
    patch({ examActive: isExamBusy(getExamActivities(), getPathname()) });
    if (staged) void evaluateActivation(false);
  };

  const dismissNotice = (): void => {
    clearBootNotice(kv);
    patch({ notice: null });
  };  const dispose = (): void => {
    disposed = true;
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    listeners.clear();
  };

  const subscribe = (
    listener: (next: OtaSnapshot) => void
  ): (() => void) => {
    listeners.add(listener);
    listener(snapshot);
    return () => {
      listeners.delete(listener);
    };
  };

  return {
    getSnapshot: () => snapshot,
    subscribe,
    initialize,
    checkForUpdate,
    activate,
    restoreBuiltin,
    reloadCurrent,
    evaluateActivation,
    handleForeground,
    handleOnline,
    handleAuthChange,
    handleExamActivityChange,
    dismissNotice,
    dispose,
  };
};
