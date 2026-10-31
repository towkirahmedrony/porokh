/**
 * Phase 2 OTA contracts.
 *
 * The updater deliberately separates "downloaded/staged" from "activated":
 * a bundle is only an active update after the next boot confirms it and the
 * exam activation gate has allowed the switch.
 */

export type OtaPhase =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'up_to_date'
  | 'available'
  | 'downloading'
  | 'staged'
  | 'activation_blocked'
  | 'activating'
  | 'activated'
  | 'check_failed'
  | 'download_failed'
  | 'rejected'
  | 'activation_failed'
  | 'recovery';

export type OtaBlockReason =
  | 'exam_active'
  | 'exam_route'
  | 'practice_active'
  | 'battle_active'
  | 'recovery_in_progress'
  | 'submission_pending'
  | 'pending_answers'
  | 'attempt_unresolved'
  | 'auth_unknown'
  | 'storage_unavailable'
  | 'storage_schema_incompatible'
  | 'native_incompatible'
  | 'channel_mismatch'
  | 'metadata_invalid'
  | 'checksum_invalid'
  | 'unsigned_bundle'
  | 'activation_not_applied'
  | 'plugin_unavailable';

export type ReleaseMetadata = {
  /** Semver base without the OTA suffix, e.g. 1.4.0. */
  baseVersion: string;
  /** Capgo channel this bundle was built for, e.g. production-android. */
  channel: string;
  /** Optional monotonic release revision (`r000042`). Null for legacy bundles. */
  revision: number | null;
  /** Minimum installed native app version, e.g. 1.2.0. */
  minNativeVersion: string;
  /** Local storage schema the bundle was built against. */
  requiredSchemaVersion: number;
};

export type CandidateRelease = {
  version: string;
  url: string;
  /** Manifest checksum: a signed RSA block when the release is signed. */
  checksum: string;
  sessionKey?: string;
  metadata: ReleaseMetadata;
  /** True when this build requires (and this release carries) a signature. */
  signatureRequired?: boolean;
};

export type ProviderLatest = {
  version: string;
  url: string;
  checksum: string;
  sessionKey?: string;
  kind?: 'up_to_date' | 'blocked' | 'failed';
  error?: string;
  old?: string;
  major?: boolean;
};

export type ProviderBundle = {
  id: string;
  version: string;
  /** SHA-256 of the installed bundle (plain hex), never the signed manifest value. */
  checksum: string;
  status: 'success' | 'error' | 'pending' | 'downloading';
  /** ISO timestamp from the plugin; used to decide which bundle to retain. */
  downloadedAt?: string;
  /** `builtin` is the copy inside the APK and must never be deleted. */
  builtin?: boolean;
};

export type ProviderCurrent = {
  bundle: ProviderBundle;
  native: string;
};

export type DownloadProgress = {
  percent: number;
  version: string;
};

export type StagedUpdate = {
  id: string;
  version: string;
  /**
   * SHA-256 of the verified local bundle (plain hex).
   *
   * The signed manifest checksum is deliberately *not* stored here: it is an
   * RSA block, and comparing it with the local digest was the reason enabling
   * signing would have rejected every verified download.
   */
  checksum: string;
  /** Manifest checksum as served (signed blob or plain digest), for auditing. */
  manifestChecksum?: string;
  metadata: ReleaseMetadata;
  stagedAt: number;
  /** True when the release carried a key-v2 signature that the plugin verified. */
  signed?: boolean;
};

export type PendingActivation = {
  id: string;
  version: string;
  previousVersion: string;
  startedAt: number;
};

export type OtaRetryState = {
  key: string;
  attempts: number;
  nextAt: number;
};

export type OtaRejection = {
  version: string;
  reasons: OtaBlockReason[];
  nextAt: number;
  at: number;
};

export type OtaBootNotice = {
  phase: 'activated' | 'activation_failed' | 'recovery';
  version: string;
  reasons?: OtaBlockReason[];
  at: number;
};

export type ActivationDecision = {
  allowed: boolean;
  reasons: OtaBlockReason[];
};

export type OtaSnapshot = {
  /** False on the website/PWA; OTA never runs there. */
  available: boolean;
  phase: OtaPhase;
  currentVersion: string | null;
  builtinVersion: string | null;
  /** Installed native APK/runtime version reported by the Capgo adapter. */
  nativeVersion?: string | null;
  channel: string;
  latestVersion: string | null;
  stagedVersion: string | null;
  activatedVersion: string | null;
  progress: number;
  reasons: OtaBlockReason[];
  error: string | null;
  lastCheckedAt: number | null;
  notice: OtaBootNotice | null;
  examActive: boolean;
};

export interface OtaUpdaterAdapter {
  isAvailable(): Promise<boolean>;
  getLatest(): Promise<ProviderLatest>;
  getBuiltinVersion(): Promise<string>;
  getChannel(): Promise<string | null>;
  current(): Promise<ProviderCurrent>;
  list(): Promise<ProviderBundle[]>;
  download(release: {
    url: string;
    version: string;
    checksum: string;
    sessionKey?: string;
  }): Promise<ProviderBundle>;
  deleteBundle(id: string): Promise<void>;
  notifyAppReady(): Promise<void>;
  setBundle(id: string): Promise<void>;
  resetToLastSuccessful(): Promise<void>;
  /** Optional: drop back to the bundle shipped inside the APK. */
  resetToBuiltin?(): Promise<void>;
  reload(): Promise<void>;
  subscribeProgress(listener: (progress: DownloadProgress) => void): () => void;
}

export type AuthSnapshot = {
  state: 'unknown' | 'anonymous' | 'authenticated';
  userId: string | null;
};

export type ExamActivityKind =
  | 'exam_active'
  | 'practice_active'
  | 'battle_active'
  | 'recovery'
  | 'submission_pending'
  | 'pending_answers';

export type ExamActivity = {
  id: string;
  kind: ExamActivityKind;
  startedAt: number;
};
