import test from 'node:test';
import assert from 'node:assert/strict';

import { createOtaController, type OtaController } from './controller.ts';
import {
  MemoryOtaKeyValue,
  OTA_STORAGE_KEYS,
  readPendingActivation,
  readRejection,
  writePendingActivation,
  type OtaKeyValue,
} from './persistence.ts';
import {
  beginExamActivity,
  resetExamActivityForTests,
} from './examActivity.ts';
import { buildReleaseVersion } from './version.ts';
import { MemoryOfflineExamStorage } from '../exam/offline/storage.ts';
import type {
  AuthSnapshot,
  DownloadProgress,
  OtaBlockReason,
  OtaUpdaterAdapter,
  ProviderBundle,
  ProviderCurrent,
  ProviderLatest,
} from './types.ts';
import type {
  AnswerRecord,
  ExamAttemptRecord,
  SubmissionRecord,
} from '../exam/offline/types.ts';

const CHANNEL = 'production-android';
/** SHA-256 of the bundle *and* the manifest value of an unsigned release. */
const CHECKSUM = 'a'.repeat(64);
/** RSA-2048 block a signed release carries instead of a digest. */
const SIGNED_CHECKSUM = 'b'.repeat(512);
const SESSION_KEY = 'aXY=:c2Vzc2lvbmtleQ==';

const releaseVersion = (
  base: string,
  overrides: {
    revision?: number;
    minNative?: string;
    schema?: number;
    channel?: string;
  } = {}
): string =>
  buildReleaseVersion({
    baseVersion: base,
    channel: overrides.channel ?? CHANNEL,
    revision: overrides.revision ?? 1,
    minNativeVersion: overrides.minNative ?? '1.0.0',
    requiredSchemaVersion: overrides.schema ?? 2,
  });

const RELEASE = releaseVersion('1.1.0');

const anonymous: AuthSnapshot = { state: 'anonymous', userId: null };

class FakeAdapter implements OtaUpdaterAdapter {
  available = true;
  latest: ProviderLatest | null = null;
  builtin = '1.0.0';
  channel: string | null = CHANNEL;
  currentBundle: ProviderBundle = {
    id: 'builtin',
    version: '1.0.0',
    checksum: '',
    status: 'success',
  };
  bundles: ProviderBundle[] = [];
  downloadResult: ProviderBundle | null = null;
  downloadError: Error | null = null;
  setError: Error | null = null;
  progressListener: ((progress: DownloadProgress) => void) | null = null;

  getLatestCalls = 0;
  downloadCalls: Array<{ url: string; version: string; checksum: string }> = [];
  notifyCalls = 0;
  setCalls: string[] = [];
  resetCalls = 0;
  reloadCalls = 0;
  deleted: string[] = [];

  async isAvailable(): Promise<boolean> {
    return this.available;
  }

  async getLatest(): Promise<ProviderLatest> {
    this.getLatestCalls += 1;
    if (!this.latest) {
      throw new Error('no latest configured');
    }
    return this.latest;
  }

  async getBuiltinVersion(): Promise<string> {
    return this.builtin;
  }

  async getChannel(): Promise<string | null> {
    return this.channel;
  }

  async current(): Promise<ProviderCurrent> {
    return { bundle: this.currentBundle, native: this.builtin };
  }

  async list(): Promise<ProviderBundle[]> {
    return [...this.bundles];
  }

  async download(release: {
    url: string;
    version: string;
    checksum: string;
  }): Promise<ProviderBundle> {
    this.downloadCalls.push(release);
    if (this.downloadError) throw this.downloadError;

    // The plugin reports the digest it computed over the extracted bundle. For a
    // signed release that is NOT the manifest value (an RSA block).
    const bundle: ProviderBundle = this.downloadResult ?? {
      id: 'bundle-1',
      version: release.version,
      checksum: CHECKSUM,
      status: 'success',
    };

    if (bundle.status === 'success' || bundle.status === 'pending') {
      this.bundles.push(bundle);
    }
    return bundle;
  }

  async deleteBundle(id: string): Promise<void> {
    this.deleted.push(id);
    this.bundles = this.bundles.filter((bundle) => bundle.id !== id);
  }

  async notifyAppReady(): Promise<void> {
    this.notifyCalls += 1;
  }

  async setBundle(id: string): Promise<void> {
    if (this.setError) throw this.setError;
    this.setCalls.push(id);
  }

  async resetToLastSuccessful(): Promise<void> {
    this.resetCalls += 1;
    this.currentBundle = {
      id: 'builtin',
      version: this.builtin,
      checksum: '',
      status: 'success',
    };
  }

  async reload(): Promise<void> {
    this.reloadCalls += 1;
  }

  subscribeProgress(
    listener: (progress: DownloadProgress) => void
  ): () => void {
    this.progressListener = listener;
    return () => {
      this.progressListener = null;
    };
  }
}

type Harness = {
  controller: OtaController;
  adapter: FakeAdapter;
  kv: OtaKeyValue;
  storage: MemoryOfflineExamStorage;
};

const harness = (
  options: {
    kv?: OtaKeyValue;
    storage?: MemoryOfflineExamStorage;
    auth?: AuthSnapshot;
    pathname?: string;
    autoActivate?: boolean;
    requireSignature?: boolean;
    retainedBundles?: number;
  } = {}
): Harness => {
  const adapter = new FakeAdapter();
  const kv = options.kv ?? new MemoryOtaKeyValue();
  const storage = options.storage ?? new MemoryOfflineExamStorage();
  const controller = createOtaController({
    adapter,
    kv,
    storage,
    channel: CHANNEL,
    getAuth: () => options.auth ?? anonymous,
    getPathname: () => options.pathname ?? '/dashboard',
    initialCheckDelayMs: -1,
    activationGraceMs: 0,
    autoActivate: options.autoActivate ?? false,
    requireSignature: options.requireSignature ?? false,
    retainedBundles: options.retainedBundles,
  });

  return { controller, adapter, kv, storage };
};

const setLatest = (
  adapter: FakeAdapter,
  version = RELEASE,
  checksum = CHECKSUM,
  sessionKey?: string
): void => {
  adapter.latest = {
    version,
    url: 'https://example.com/bundle.zip',
    checksum,
    ...(sessionKey ? { sessionKey } : {}),
  };
};

const attemptRecord = (
  overrides: Partial<ExamAttemptRecord> = {}
): ExamAttemptRecord => ({
  key: 'practice:e1',
  userId: 'u1',
  scope: 'practice',
  attemptId: 'a1',
  examId: 'e1',
  status: 'submitted',
  offlinePolicy: 'offline_allowed',
  startedAt: null,
  deadlineAt: null,
  serverTimeAtSync: null,
  clientTimeAtSync: null,
  wallHighWaterMs: null,
  secondsRemainingAtSync: null,
  durationSeconds: 600,
  questionIds: ['q1'],
  questionsVersion: null,
  prepared: true,
  currentIndex: 0,
  lastServerUpdatedAt: null,
  lastSyncedAt: null,
  lastSyncError: null,
  syncAttempts: 0,
  nextSyncAt: null,
  submissionId: 's1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const submissionRecord = (
  overrides: Partial<SubmissionRecord> = {}
): SubmissionRecord => ({
  attemptId: 'a1',
  userId: 'u1',
  status: 'confirmed',
  idempotencyKey: 'key-1',
  payload: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  attempts: 1,
  lastAttemptAt: null,
  lastError: null,
  resultId: 'r1',
  result: null,
  ...overrides,
});

const answerRecord = (overrides: Partial<AnswerRecord> = {}): AnswerRecord => ({
  id: 'a1:q1',
  attemptId: 'a1',
  userId: 'u1',
  questionId: 'q1',
  value: 'A',
  revision: 1,
  operationId: 'op-1',
  updatedAt: '2026-01-01T00:00:00.000Z',
  status: 'synced',
  lastError: null,
  ...overrides,
});

test.beforeEach(() => {
  resetExamActivityForTests();
});

test('web/unavailable runtime disables OTA without touching the plugin', async () => {
  const { controller, adapter } = harness();
  adapter.available = false;

  await controller.initialize();

  const snapshot = controller.getSnapshot();
  assert.equal(snapshot.available, false);
  assert.equal(snapshot.phase, 'disabled');
  assert.equal(adapter.getLatestCalls, 0);
  assert.equal(adapter.notifyCalls, 0);
});

test('check verifies, downloads and stages without activating', async () => {
  const { controller, adapter } = harness();
  setLatest(adapter);
  await controller.initialize();
  assert.equal(adapter.notifyCalls, 1);

  await controller.checkForUpdate(true);

  assert.equal(adapter.downloadCalls.length, 1);
  assert.equal(adapter.downloadCalls[0].url, 'https://example.com/bundle.zip');
  assert.equal(adapter.downloadCalls[0].version, RELEASE);
  assert.equal(adapter.downloadCalls[0].checksum, CHECKSUM);
  assert.equal(controller.getSnapshot().phase, 'staged');
  assert.equal(controller.getSnapshot().stagedVersion, RELEASE);
  assert.equal(adapter.setCalls.length, 0);
  assert.equal(adapter.notifyCalls, 1, 'notifying at stage time would be wrong');
});

test('activation writes a pending marker, set() runs and success is only confirmed next boot', async () => {
  const first = harness();
  setLatest(first.adapter);
  await first.controller.initialize();
  await first.controller.checkForUpdate(true);

  const decision = await first.controller.activate();
  assert.deepEqual(decision, { allowed: true, reasons: [] });
  assert.deepEqual(first.adapter.setCalls, ['bundle-1']);
  assert.equal(first.controller.getSnapshot().phase, 'activating');

  const pending = readPendingActivation(first.kv);
  assert.equal(pending?.version, RELEASE);

  // Simulate the WebView reload: a new controller sees the staged bundle as
  // current and the pending marker from the previous session.
  const rebootAdapter = new FakeAdapter();
  rebootAdapter.latest = first.adapter.latest;
  rebootAdapter.currentBundle = {
    id: 'bundle-1',
    version: RELEASE,
    checksum: CHECKSUM,
    status: 'success',
  };
  rebootAdapter.bundles = [rebootAdapter.currentBundle];
  const reboot = createOtaController({
    adapter: rebootAdapter,
    kv: first.kv,
    storage: first.storage,
    channel: CHANNEL,
    getAuth: () => anonymous,
    initialCheckDelayMs: -1,
    activationGraceMs: 0,
    autoActivate: false,
  });

  await reboot.initialize();

  assert.equal(rebootAdapter.notifyCalls, 1);
  assert.equal(rebootAdapter.resetCalls, 0);
  assert.equal(reboot.getSnapshot().phase, 'activated');
  assert.equal(reboot.getSnapshot().notice?.phase, 'activated');
  assert.equal(readPendingActivation(first.kv), null);
  assert.equal(first.kv.getItem(OTA_STORAGE_KEYS.staged), null);
});

test('automatic checks are deferred during an exam, manual checks are allowed', async () => {
  const { controller, adapter } = harness();
  setLatest(adapter);
  await controller.initialize();

  const release = beginExamActivity('runtime-exam', 'exam_active');
  await controller.checkForUpdate(false);
  assert.equal(adapter.getLatestCalls, 0);

  await controller.checkForUpdate(true);
  assert.equal(adapter.getLatestCalls, 1);

  release();
  const decision = await controller.evaluateActivation(false);
  assert.equal(decision.allowed, true);
});

test('runtime exam activity blocks activation even after download', async () => {
  const { controller, adapter } = harness();
  setLatest(adapter);
  await controller.initialize();
  await controller.checkForUpdate(true);

  const release = beginExamActivity('runtime-exam', 'exam_active');
  const blocked = await controller.evaluateActivation(false);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.reasons.includes('exam_active'));
  assert.equal(controller.getSnapshot().phase, 'activation_blocked');
  assert.equal(adapter.setCalls.length, 0);

  release();
  const allowed = await controller.evaluateActivation(false);
  assert.equal(allowed.allowed, true);
  assert.equal(controller.getSnapshot().phase, 'staged');
});

test('persisted pending submission blocks activation after relaunch', async () => {
  const storage = new MemoryOfflineExamStorage();
  await storage.putAttempt(attemptRecord({ status: 'in_progress' }));
  await storage.putSubmission(submissionRecord({ status: 'pending' }));
  await storage.putAnswerIfNewer(answerRecord({ status: 'pending' }));

  const { controller, adapter } = harness({
    storage,
    auth: { state: 'authenticated', userId: 'u1' },
  });
  setLatest(adapter);
  await controller.initialize();
  await controller.checkForUpdate(true);

  const snapshot = controller.getSnapshot();
  assert.equal(snapshot.phase, 'activation_blocked');
  assert.ok(snapshot.reasons.includes('attempt_unresolved'));
  assert.ok(snapshot.reasons.includes('submission_pending'));
  assert.ok(snapshot.reasons.includes('pending_answers'));

  const blocked = await controller.activate();
  assert.equal(blocked.allowed, false);
  assert.equal(adapter.setCalls.length, 0);
});

test('non-durable storage blocks activation because the next boot cannot be verified', async () => {
  const storage = new MemoryOfflineExamStorage();
  await storage.putAttempt(attemptRecord());
  await storage.putSubmission(submissionRecord());
  await storage.putAnswerIfNewer(answerRecord());

  const { controller, adapter } = harness({
    storage,
    kv: new MemoryOtaKeyValue(false),
    auth: { state: 'authenticated', userId: 'u1' },
  });
  setLatest(adapter);
  await controller.initialize();
  await controller.checkForUpdate(true);

  assert.equal(controller.getSnapshot().phase, 'activation_blocked');
  assert.ok(controller.getSnapshot().reasons.includes('storage_unavailable'));
  assert.equal(adapter.setCalls.length, 0);
});

test('completed local exam data allows activation', async () => {
  const storage = new MemoryOfflineExamStorage();
  await storage.putAttempt(attemptRecord());
  await storage.putSubmission(submissionRecord());
  await storage.putAnswerIfNewer(answerRecord());

  const { controller, adapter } = harness({
    storage,
    auth: { state: 'authenticated', userId: 'u1' },
  });
  setLatest(adapter);
  await controller.initialize();
  await controller.checkForUpdate(true);

  assert.equal(controller.getSnapshot().phase, 'staged');
  const decision = await controller.activate();
  assert.equal(decision.allowed, true);
  assert.equal(adapter.setCalls.length, 1);
});

test('a staged bundle is rejected when local schema is incompatible', async () => {
  const kv = new MemoryOtaKeyValue();
  kv.setItem(
    OTA_STORAGE_KEYS.localSchema,
    JSON.stringify({ schemaVersion: 3, createdAt: '' })
  );
  const { controller, adapter } = harness({ kv });
  setLatest(adapter);
  await controller.initialize();
  await controller.checkForUpdate(true);

  const decision = await controller.evaluateActivation(false);
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.includes('storage_schema_incompatible'));
  assert.equal(controller.getSnapshot().phase, 'activation_blocked');
  assert.equal(adapter.setCalls.length, 0);
});

test('checksum mismatch deletes the bundle and never stages it', async () => {
  const { controller, adapter, kv } = harness();
  setLatest(adapter);
  adapter.downloadResult = {
    id: 'bad-bundle',
    version: RELEASE,
    checksum: 'wrong',
    status: 'success',
  };

  await controller.initialize();
  await controller.checkForUpdate(true);

  const snapshot = controller.getSnapshot();
  assert.equal(snapshot.phase, 'rejected');
  assert.ok(snapshot.reasons.includes('checksum_invalid'));
  assert.deepEqual(adapter.deleted, ['bad-bundle']);
  assert.equal(snapshot.stagedVersion, null);
  assert.equal(readRejection(kv)?.version, RELEASE);
});

test('a bundle with the wrong version is discarded', async () => {
  const { controller, adapter } = harness();
  setLatest(adapter);
  adapter.downloadResult = {
    id: 'wrong-version',
    version: '9.9.9-ota.production-android.nv1.0.0.db1',
    checksum: CHECKSUM,
    status: 'success',
  };

  await controller.initialize();
  await controller.checkForUpdate(true);

  assert.equal(controller.getSnapshot().phase, 'download_failed');
  assert.deepEqual(adapter.deleted, ['wrong-version']);
});

test('a failed plugin download uses bounded retry state', async () => {
  const { controller, adapter, kv } = harness();
  setLatest(adapter);
  adapter.downloadError = new Error('network down');

  await controller.initialize();
  await controller.checkForUpdate(true);

  assert.equal(controller.getSnapshot().phase, 'download_failed');
  const retry = JSON.parse(
    kv.getItem(OTA_STORAGE_KEYS.downloadRetry) ?? '{}'
  );
  assert.equal(retry.key, RELEASE);
  assert.equal(retry.attempts, 1);
  assert.ok(retry.nextAt > Date.now() - 1);
});

test('channel, schema and native incompatibilities are rejected before download', async () => {
  const cases: Array<{ version: string; reason: string }> = [
    {
      version: releaseVersion('1.1.0', { channel: 'staging-android' }),
      reason: 'channel_mismatch',
    },
    {
      version: releaseVersion('1.1.0', { schema: 3 }),
      reason: 'storage_schema_incompatible',
    },
    {
      version: releaseVersion('1.1.0', { minNative: '9.0.0' }),
      reason: 'native_incompatible',
    },
  ];

  for (const item of cases) {
    const { controller, adapter } = harness();
    setLatest(adapter, item.version);
    await controller.initialize();
    await controller.checkForUpdate(true);

    const snapshot = controller.getSnapshot();
    assert.equal(snapshot.phase, 'rejected', item.reason);
    assert.ok(
      snapshot.reasons.includes(item.reason as OtaBlockReason),
      item.reason
    );
    assert.equal(adapter.downloadCalls.length, 0, item.reason);
  }
});

test('downgrades are rejected', async () => {
  const { controller, adapter } = harness();
  adapter.currentBundle = {
    id: 'current',
    version: releaseVersion('1.2.0'),
    checksum: 'old',
    status: 'success',
  };
  adapter.builtin = '1.2.0';
  setLatest(adapter, releaseVersion('1.1.0'));

  await controller.initialize();
  await controller.checkForUpdate(true);

  assert.equal(controller.getSnapshot().phase, 'rejected');
  assert.ok(controller.getSnapshot().reasons.includes('metadata_invalid'));
  assert.equal(adapter.downloadCalls.length, 0);
});

test('installed version is reported up to date without download', async () => {
  const { controller, adapter } = harness();
  adapter.currentBundle = {
    id: 'bundle-1',
    version: RELEASE,
    checksum: CHECKSUM,
    status: 'success',
  };
  adapter.latest = {
    version: RELEASE,
    url: 'https://example.com/bundle.zip',
    checksum: CHECKSUM,
  };

  await controller.initialize();
  await controller.checkForUpdate(true);

  assert.equal(controller.getSnapshot().phase, 'up_to_date');
  assert.equal(adapter.downloadCalls.length, 0);
});

test('a Capgo up_to_date response is not treated as a failed check', async () => {
  const { controller, adapter, kv } = harness();
  adapter.currentBundle = {
    id: 'bundle-1',
    version: RELEASE,
    checksum: CHECKSUM,
    status: 'success',
  };
  adapter.latest = {
    version: RELEASE,
    url: 'https://example.com/bundle.zip',
    checksum: CHECKSUM,
    kind: 'up_to_date',
    error: 'no_new_version_available',
  };

  await controller.initialize();
  await controller.checkForUpdate(true);

  const snapshot = controller.getSnapshot();
  assert.equal(snapshot.phase, 'up_to_date');
  assert.equal(snapshot.error, null);
  assert.equal(kv.getItem(OTA_STORAGE_KEYS.checkRetry), null);
  assert.equal(adapter.downloadCalls.length, 0);
});

test('a Capgo blocked response is rejected without downloading', async () => {
  const { controller, adapter } = harness();
  adapter.latest = {
    version: RELEASE,
    url: 'https://example.com/bundle.zip',
    checksum: CHECKSUM,
    kind: 'blocked',
    error: 'device_blocked',
  };

  await controller.initialize();
  await controller.checkForUpdate(true);

  const snapshot = controller.getSnapshot();
  assert.equal(snapshot.phase, 'rejected');
  assert.deepEqual(snapshot.reasons, ['channel_mismatch']);
  assert.equal(adapter.downloadCalls.length, 0);
});

test('a staged bundle that no longer matches the installed bundle is discarded', async () => {
  const { controller, adapter } = harness();
  setLatest(adapter);
  await controller.initialize();
  await controller.checkForUpdate(true);
  assert.equal(controller.getSnapshot().phase, 'staged');

  adapter.bundles[0] = { ...adapter.bundles[0], checksum: 'tampered' };

  const decision = await controller.activate();

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.includes('checksum_invalid'));
  assert.equal(adapter.setCalls.length, 0);
  assert.equal(adapter.deleted.length, 1);
  assert.equal(controller.getSnapshot().phase, 'rejected');
});

test('set() failure leaves the bundle staged and clears the pending marker', async () => {
  const { controller, adapter, kv } = harness();
  setLatest(adapter);
  await controller.initialize();
  await controller.checkForUpdate(true);
  adapter.setError = new Error('set failed');

  const decision = await controller.activate();

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.includes('activation_not_applied'));
  assert.equal(controller.getSnapshot().phase, 'staged');
  assert.match(controller.getSnapshot().error ?? '', /set failed/);
  assert.equal(readPendingActivation(kv), null);
  assert.equal(controller.getSnapshot().stagedVersion, RELEASE);
});

test('activation is aborted when the pending marker cannot be persisted', async () => {
  const base = new MemoryOtaKeyValue();
  const kv: OtaKeyValue = {
    durable: true,
    getItem: (key) => base.getItem(key),
    setItem: (key, value) => {
      if (key === OTA_STORAGE_KEYS.pendingActivation) return;
      base.setItem(key, value);
    },
    removeItem: (key) => base.removeItem(key),
  };
  const { controller, adapter } = harness({ kv });
  setLatest(adapter);
  await controller.initialize();
  await controller.checkForUpdate(true);

  const decision = await controller.activate();

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.includes('storage_unavailable'));
  assert.equal(adapter.setCalls.length, 0);
  assert.equal(controller.getSnapshot().phase, 'staged');
  assert.equal(readPendingActivation(kv), null);
});

test('pending bundle that did not run is rolled back and cooled down', async () => {
  const kv = new MemoryOtaKeyValue();
  writePendingActivation(kv, {
    id: 'bundle-1',
    version: RELEASE,
    previousVersion: '1.0.0',
    startedAt: Date.now(),
  });

  const { controller, adapter } = harness({ kv });
  adapter.latest = {
    version: RELEASE,
    url: 'https://example.com/bundle.zip',
    checksum: CHECKSUM,
  };
  adapter.currentBundle = {
    id: 'builtin',
    version: '1.0.0',
    checksum: '',
    status: 'success',
  };

  await controller.initialize();

  assert.equal(adapter.notifyCalls, 1, 'current bundle must be confirmed');
  assert.equal(controller.getSnapshot().phase, 'activation_failed');
  assert.equal(controller.getSnapshot().notice?.phase, 'activation_failed');
  assert.equal(readPendingActivation(kv), null);
  assert.equal(readRejection(kv)?.version, RELEASE);
});

test('a candidate that breaks local storage is rolled back, not confirmed', async () => {
  const first = harness();
  setLatest(first.adapter);
  await first.controller.initialize();
  await first.controller.checkForUpdate(true);
  await first.controller.activate();

  // A bundle that wrote a newer schema: this build cannot read it, and no
  // amount of retrying changes that.
  first.kv.setItem(
    OTA_STORAGE_KEYS.localSchema,
    JSON.stringify({ schemaVersion: 3, createdAt: '' })
  );

  const rebootAdapter = new FakeAdapter();
  rebootAdapter.latest = first.adapter.latest;
  rebootAdapter.currentBundle = {
    id: 'bundle-1',
    version: RELEASE,
    checksum: CHECKSUM,
    status: 'success',
  };
  rebootAdapter.bundles = [rebootAdapter.currentBundle];
  const reboot = createOtaController({
    adapter: rebootAdapter,
    kv: first.kv,
    storage: first.storage,
    channel: CHANNEL,
    getAuth: () => anonymous,
    initialCheckDelayMs: -1,
    activationGraceMs: 0,
    autoActivate: false,
  });

  await reboot.initialize();

  assert.equal(rebootAdapter.notifyCalls, 0);
  assert.equal(rebootAdapter.resetCalls, 1);
  assert.equal(rebootAdapter.reloadCalls, 1);
  assert.equal(reboot.getSnapshot().phase, 'recovery');
  assert.ok(reboot.getSnapshot().reasons.includes('storage_schema_incompatible'));
});

test('auto activation runs only when the gate is open and activation is allowed', async () => {
  const { controller, adapter } = harness({ autoActivate: true });
  setLatest(adapter);
  await controller.initialize();
  await controller.checkForUpdate(true);

  const release = beginExamActivity('runtime-exam', 'exam_active');
  let decision = await controller.evaluateActivation(true);
  assert.equal(decision.allowed, false);
  assert.equal(adapter.setCalls.length, 0);
  release();

  decision = await controller.evaluateActivation(true);
  assert.equal(decision.allowed, true);
  assert.equal(adapter.setCalls.length, 1);
});

/* ------------------------------------------------------------------ *
 * Publisher authenticity
 * ------------------------------------------------------------------ */

test('an unsigned release is rejected before download when signatures are required', async () => {
  const { controller, adapter } = harness({ requireSignature: true });
  // A clear release: plain digest, no session key — exactly what an upload
  // without --key-v2 produces.
  setLatest(adapter, RELEASE, CHECKSUM);

  await controller.initialize();
  await controller.checkForUpdate(true);

  assert.equal(controller.getSnapshot().phase, 'rejected');
  assert.ok(controller.getSnapshot().reasons.includes('unsigned_bundle'));
  assert.equal(adapter.downloadCalls.length, 0, 'nothing may be downloaded');
  assert.equal(adapter.setCalls.length, 0);
});

test('a release with a session key but a plain checksum is still rejected', async () => {
  const { controller, adapter } = harness({ requireSignature: true });
  setLatest(adapter, RELEASE, CHECKSUM, SESSION_KEY);

  await controller.initialize();
  await controller.checkForUpdate(true);

  assert.ok(controller.getSnapshot().reasons.includes('unsigned_bundle'));
  assert.equal(adapter.downloadCalls.length, 0);
});

test('a signed release is accepted and staged with the local digest', async () => {
  const { controller, adapter, kv } = harness({ requireSignature: true });
  setLatest(adapter, RELEASE, SIGNED_CHECKSUM, SESSION_KEY);

  await controller.initialize();
  await controller.checkForUpdate(true);

  const snapshot = controller.getSnapshot();
  assert.equal(snapshot.phase, 'staged');
  assert.equal(adapter.downloadCalls.length, 1);
  assert.equal(
    adapter.downloadCalls[0].checksum,
    SIGNED_CHECKSUM,
    'the signed manifest value must be handed to the plugin for verification'
  );

  const staged = JSON.parse(kv.getItem(OTA_STORAGE_KEYS.staged) ?? '{}');
  assert.equal(
    staged.checksum,
    CHECKSUM,
    'staged state records the digest of the extracted bundle'
  );
  assert.equal(staged.manifestChecksum, SIGNED_CHECKSUM);
  assert.equal(staged.signed, true);
});

test('a downloaded pending bundle is verified, staged, and activatable', async () => {
  const { controller, adapter } = harness({ requireSignature: true });
  setLatest(adapter, RELEASE, SIGNED_CHECKSUM, SESSION_KEY);
  adapter.downloadResult = {
    id: 'bundle-pending',
    version: RELEASE,
    checksum: CHECKSUM,
    status: 'pending',
  };

  await controller.initialize();
  await controller.checkForUpdate(true);

  assert.equal(controller.getSnapshot().phase, 'staged');
  assert.equal(controller.getSnapshot().stagedVersion, RELEASE);
  assert.equal(adapter.deleted.length, 0);

  const decision = await controller.activate();
  assert.equal(decision.allowed, true);
  assert.deepEqual(adapter.setCalls, ['bundle-pending']);
});

test('a signed release whose extracted digest is not a digest is rejected', async () => {
  const { controller, adapter } = harness({ requireSignature: true });
  setLatest(adapter, RELEASE, SIGNED_CHECKSUM, SESSION_KEY);
  // A plugin that extracted an undecryptable payload reports a non-digest.
  adapter.downloadResult = {
    id: 'bundle-1',
    version: RELEASE,
    checksum: 'not-a-digest',
    status: 'success',
  };

  await controller.initialize();
  await controller.checkForUpdate(true);

  assert.equal(controller.getSnapshot().phase, 'rejected');
  assert.ok(controller.getSnapshot().reasons.includes('checksum_invalid'));
  assert.ok(adapter.deleted.includes('bundle-1'));
});

test('without signature enforcement an unsigned release still verifies its checksum', async () => {
  const { controller, adapter } = harness();
  setLatest(adapter, RELEASE, CHECKSUM);
  adapter.downloadResult = {
    id: 'bundle-1',
    version: RELEASE,
    checksum: 'f'.repeat(64),
    status: 'success',
  };

  await controller.initialize();
  await controller.checkForUpdate(true);

  assert.ok(controller.getSnapshot().reasons.includes('checksum_invalid'));
  assert.ok(adapter.deleted.includes('bundle-1'));
});

test('a republished older revision is refused as a downgrade', async () => {
  const { controller, adapter } = harness();
  adapter.currentBundle = {
    id: 'current',
    version: releaseVersion('1.1.0', { revision: 9 }),
    checksum: 'c'.repeat(64),
    status: 'success',
  };
  adapter.builtin = '1.0.0';
  setLatest(adapter, releaseVersion('1.1.0', { revision: 8 }));

  await controller.initialize();
  await controller.checkForUpdate(true);

  assert.equal(controller.getSnapshot().phase, 'rejected');
  assert.ok(controller.getSnapshot().reasons.includes('metadata_invalid'));
  assert.equal(adapter.downloadCalls.length, 0);
});

/* ------------------------------------------------------------------ *
 * Rollback bundle retention
 * ------------------------------------------------------------------ */

test('confirmation keeps the running bundle plus one fallback and deletes the rest', async () => {
  const { controller, adapter, kv } = harness({ retainedBundles: 2 });

  adapter.currentBundle = {
    id: 'current',
    version: releaseVersion('1.2.0', { revision: 3 }),
    checksum: 'c'.repeat(64),
    status: 'success',
    downloadedAt: '2026-01-03T00:00:00.000Z',
  };
  adapter.bundles = [
    { id: 'builtin', version: '1.0.0', checksum: '', status: 'success', builtin: true },
    adapter.currentBundle,
    {
      id: 'fallback',
      version: releaseVersion('1.1.0', { revision: 2 }),
      checksum: 'b'.repeat(64),
      status: 'success',
      downloadedAt: '2026-01-02T00:00:00.000Z',
    },
    {
      id: 'ancient',
      version: releaseVersion('1.0.1', { revision: 1 }),
      checksum: 'a'.repeat(64),
      status: 'success',
      downloadedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'broken',
      version: releaseVersion('1.0.2', { revision: 1 }),
      checksum: 'd'.repeat(64),
      status: 'error',
      downloadedAt: '2026-01-01T12:00:00.000Z',
    },
  ];

  writePendingActivation(kv, {
    id: 'current',
    version: adapter.currentBundle.version,
    previousVersion: 'builtin',
    startedAt: Date.now(),
  });

  await controller.initialize();

  assert.equal(adapter.notifyCalls, 1);
  assert.ok(adapter.deleted.includes('ancient'), 'old bundles are pruned');
  assert.ok(adapter.deleted.includes('broken'), 'failed bundles are pruned');
  assert.ok(!adapter.deleted.includes('fallback'), 'the fallback bundle must survive');
  assert.ok(!adapter.deleted.includes('current'));
  assert.ok(!adapter.deleted.includes('builtin'), 'the APK copy must never be deleted');
});

test('pruning never removes a bundle that is still pending activation', async () => {
  const { controller, adapter } = harness({ retainedBundles: 1 });
  adapter.currentBundle = {
    id: 'current',
    version: releaseVersion('1.2.0', { revision: 3 }),
    checksum: 'c'.repeat(64),
    status: 'success',
    downloadedAt: '2026-01-03T00:00:00.000Z',
  };
  adapter.bundles = [
    { id: 'builtin', version: '1.0.0', checksum: '', status: 'success', builtin: true },
    adapter.currentBundle,
    {
      id: 'downloading',
      version: releaseVersion('1.3.0', { revision: 4 }),
      checksum: '',
      status: 'downloading',
    },
    {
      id: 'staged',
      version: releaseVersion('1.3.0', { revision: 5 }),
      checksum: 'e'.repeat(64),
      status: 'pending',
    },
  ];

  await controller.initialize();

  assert.ok(!adapter.deleted.includes('downloading'));
  assert.ok(!adapter.deleted.includes('staged'));
});

/* ------------------------------------------------------------------ *
 * Boot health: transient vs confirmed failure
 * ------------------------------------------------------------------ */

test('a transient storage failure at first boot confirms the bundle instead of rolling back', async () => {
  const storage = new MemoryOfflineExamStorage();
  const attempts = { count: 0 };
  const flaky = Object.create(storage) as MemoryOfflineExamStorage;
  flaky.init = async () => {
    attempts.count += 1;
    // Fails on the first two calls, then succeeds — the shape of a WebView that
    // is still releasing another connection.
    if (attempts.count <= 2) throw new Error('IndexedDB open blocked');
    await storage.init();
  };

  const { controller, adapter, kv } = harness({ storage: flaky });
  setLatest(adapter);
  await controller.initialize();
  await controller.checkForUpdate(true);
  await controller.activate();

  const rebootAdapter = new FakeAdapter();
  rebootAdapter.currentBundle = {
    id: 'bundle-1',
    version: RELEASE,
    checksum: CHECKSUM,
    status: 'success',
  };
  rebootAdapter.bundles = [rebootAdapter.currentBundle];

  const reboot = createOtaController({
    adapter: rebootAdapter,
    kv,
    storage: flaky,
    channel: CHANNEL,
    getAuth: () => anonymous,
    initialCheckDelayMs: -1,
    activationGraceMs: 0,
    autoActivate: false,
  });

  await reboot.initialize();

  assert.equal(rebootAdapter.resetCalls, 0, 'a flaky boot must not trigger a rollback');
  assert.equal(rebootAdapter.reloadCalls, 0);
  assert.equal(rebootAdapter.notifyCalls, 1, 'the bundle booted, so it must be confirmed');
  assert.equal(reboot.getSnapshot().phase, 'activated');
});

test('a schema the build cannot read still rolls back', async () => {
  const { controller, adapter, kv } = harness();
  setLatest(adapter);
  await controller.initialize();
  await controller.checkForUpdate(true);
  await controller.activate();

  kv.setItem(
    OTA_STORAGE_KEYS.localSchema,
    JSON.stringify({ schemaVersion: 99, createdAt: '' })
  );

  const rebootAdapter = new FakeAdapter();
  rebootAdapter.currentBundle = {
    id: 'bundle-1',
    version: RELEASE,
    checksum: CHECKSUM,
    status: 'success',
  };
  rebootAdapter.bundles = [rebootAdapter.currentBundle];

  const reboot = createOtaController({
    adapter: rebootAdapter,
    kv,
    storage: new MemoryOfflineExamStorage(),
    channel: CHANNEL,
    getAuth: () => anonymous,
    initialCheckDelayMs: -1,
    activationGraceMs: 0,
    autoActivate: false,
  });

  await reboot.initialize();

  assert.equal(rebootAdapter.notifyCalls, 0);
  assert.equal(rebootAdapter.resetCalls, 1);
  assert.equal(rebootAdapter.reloadCalls, 1);
  assert.equal(reboot.getSnapshot().phase, 'recovery');
});

test('activating an update leaves cached questions, answers and submissions readable', async () => {
  const storage = new MemoryOfflineExamStorage();
  await storage.putAttempt(attemptRecord({ status: 'submitted' }));
  await storage.putSubmission(submissionRecord({ status: 'confirmed' }));
  await storage.putAnswerIfNewer(answerRecord({ status: 'synced', value: 'B' }));
  await storage.putPreparedExam({
    key: 'offline:u1:e1',
    userId: 'u1',
    examId: 'e1',
    title: 'Prepared',
    attemptId: 'a1',
    deadlineAt: '2026-12-01T00:00:00.000Z',
    durationSeconds: 600,
    serverTimeAtSync: '2026-01-01T00:00:00.000Z',
    clientTimeAtSync: '2026-01-01T00:00:00.000Z',
    questions: [],
    questionsVersion: null,
    complete: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as never);

  const { controller, adapter } = harness({
    storage,
    auth: { state: 'authenticated', userId: 'u1' },
  });
  setLatest(adapter);
  await controller.initialize();
  await controller.checkForUpdate(true);

  assert.equal(controller.getSnapshot().phase, 'staged');
  const decision = await controller.activate();
  assert.equal(decision.allowed, true);
  assert.equal(adapter.setCalls.length, 1);

  // The bundle switch changes code, not WebView storage.
  assert.equal((await storage.getAttempt('a1'))?.status, 'submitted');
  assert.equal((await storage.getSubmission('a1'))?.status, 'confirmed');
  assert.deepEqual(
    (await storage.getAnswers('a1')).map((item) => item.value),
    ['B']
  );
  assert.equal((await storage.getPreparedExam('offline:u1:e1'))?.attemptId, 'a1');
});

test('a blocked provider reports the reason it actually failed on', async () => {
  const { controller, adapter } = harness();
  adapter.latest = {
    version: RELEASE,
    url: 'https://example.com/bundle.zip',
    checksum: CHECKSUM,
    kind: 'blocked',
    // A pointer whose Ed25519 signature did not verify.
    reason: 'unsigned_bundle',
    error: 'signature_invalid',
  };

  await controller.initialize();
  await controller.checkForUpdate(true);

  const snapshot = controller.getSnapshot();
  assert.equal(snapshot.phase, 'rejected');
  assert.deepEqual(snapshot.reasons, ['unsigned_bundle']);
  assert.equal(adapter.downloadCalls.length, 0);
});

test('an unreachable update source leaves the app usable and backs off', async () => {
  const { controller, adapter, kv } = harness();
  // No pointer: the provider throws, exactly like an offline device.
  adapter.latest = null;

  await controller.initialize();
  // Startup never waits on the network; the check is scheduled, not awaited.
  assert.equal(controller.getSnapshot().available, true);

  await controller.checkForUpdate(true);

  const snapshot = controller.getSnapshot();
  assert.equal(snapshot.phase, 'check_failed');
  assert.ok(snapshot.error);
  assert.equal(adapter.downloadCalls.length, 0);
  // A bounded retry is recorded so the next automatic check is deferred.
  const retry = JSON.parse(String(kv.getItem(OTA_STORAGE_KEYS.checkRetry))) as {
    attempts: number;
    nextAt: number;
  };
  assert.equal(retry.attempts, 1);
  assert.ok(retry.nextAt > 0);
});
