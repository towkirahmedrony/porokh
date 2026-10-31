import test from 'node:test';
import assert from 'node:assert/strict';

import {
  runForcedUpdate,
  runHardReload,
  type ForcedUpdateDeps,
  type OtaDriver,
} from './forcedUpdate.ts';
import { normalizeBuildInfo } from './buildInfo.ts';
import type { RemoteManifest } from './remoteManifest.ts';
import type { ActivationDecision, OtaSnapshot } from './types.ts';
import type { PendingReload } from './cacheRecovery.ts';

const BUILD = normalizeBuildInfo({
  version: '1.0.1',
  buildId: 'local-build',
  channel: 'production-android',
  builtAt: '2026-10-27T00:00:00.000Z',
});

const REMOTE: RemoteManifest = {
  version: '1.0.1',
  buildId: 'remote-build',
  channel: 'production-android',
  builtAt: '2026-10-28T00:00:00.000Z',
  minNativeVersion: null,
  apkUrl: null,
};

const SAME_REMOTE: RemoteManifest = {
  ...REMOTE,
  version: '1.0.1',
  buildId: 'local-build',
};

const snapshot = (partial: Partial<OtaSnapshot> = {}): OtaSnapshot => ({
  available: true,
  phase: 'idle',
  currentVersion: '1.0.0',
  builtinVersion: '1.0.0',
  channel: 'production-android',
  latestVersion: null,
  stagedVersion: null,
  activatedVersion: null,
  progress: 0,
  reasons: [],
  error: null,
  lastCheckedAt: null,
  notice: null,
  examActive: false,
  ...partial,
});

type OtaOptions = {
  phase?: Partial<OtaSnapshot>;
  decision?: ActivationDecision;
  throwOnActivate?: boolean;
};

const fakeOta = (options: OtaOptions = {}) => {
  const calls = { initialize: 0, check: 0, activate: 0, checks: [] as boolean[] };
  const state = snapshot(options.phase);

  const driver: OtaDriver = {
    initialize: async () => {
      calls.initialize += 1;
    },
    checkForUpdate: async (manual?: boolean) => {
      calls.check += 1;
      calls.checks.push(Boolean(manual));
    },
    activate: async () => {
      calls.activate += 1;
      if (options.throwOnActivate) throw new Error('set() failed');
      return options.decision ?? { allowed: true, reasons: [] };
    },
    getSnapshot: () => state,
  };

  return { driver, calls };
};

const baseDeps = (overrides: Partial<ForcedUpdateDeps> = {}): ForcedUpdateDeps => ({
  build: BUILD,
  native: false,
  otaAvailable: false,
  ota: null,
  checkManifest: async () => ({ ok: true, manifest: REMOTE, sourceUrl: 'https://x/version.json' }),
  isExamBusy: () => false,
  isOnline: () => true,
  ...overrides,
});

test('offline is reported before any request or reload', async () => {
  let reloaded = false;
  const outcome = await runForcedUpdate(
    baseDeps({
      isOnline: () => false,
      checkManifest: async () => {
        throw new Error('should not be called');
      },
      performReload: () => {
        reloaded = true;
      },
    })
  );

  assert.deepEqual(outcome, { kind: 'offline' });
  assert.equal(reloaded, false);
});

test('hard reload refuses to interrupt an active exam', async () => {
  let reloaded = false;
  const outcome = await runHardReload({
    build: BUILD,
    native: false,
    otaAvailable: false,
    isExamBusy: () => true,
    isOnline: () => true,
    performReload: () => { reloaded = true; },
  });
  assert.deepEqual(outcome, { kind: 'blocked', reasons: ['exam_active'] });
  assert.equal(reloaded, false);
});

test('hard reload on web purges frontend caches and reloads without a manifest check', async () => {
  let purged = 0;
  const captured: { pending: PendingReload | null } = { pending: null };
  const outcome = await runHardReload({
    build: BUILD,
    native: false,
    otaAvailable: false,
    isExamBusy: () => false,
    isOnline: () => true,
    now: () => 42,
    purgeCaches: async () => {
      purged += 1;
      return { deletedCaches: [], skipped: false, workerActivated: false, workerChecked: false };
    },
    performReload: (value) => { captured.pending = value; },
  });
  assert.equal(outcome.kind, 'reloaded');
  assert.equal(purged, 1);
  assert.equal(captured.pending?.targetBuildId, BUILD.buildId);
  assert.equal(captured.pending?.fromBuildId, BUILD.buildId);
  assert.equal(captured.pending?.at, 42);
});

test('hard reload on Android delegates to the OTA provider without purging caches', async () => {
  let providerReloads = 0;
  let purges = 0;
  const outcome = await runHardReload({
    build: BUILD,
    native: true,
    otaAvailable: true,
    reloadNative: async () => { providerReloads += 1; return true; },
    isExamBusy: () => false,
    isOnline: () => true,
    purgeCaches: async () => {
      purges += 1;
      return { deletedCaches: [], skipped: false, workerActivated: false, workerChecked: false };
    },
  });
  assert.equal(outcome.kind, 'reloaded');
  assert.equal(providerReloads, 1);
  assert.equal(purges, 0);
});

test('an exam in progress is never interrupted', async () => {
  let reloaded = false;
  const { driver, calls } = fakeOta({ phase: { stagedVersion: '1.0.1-ota' } });

  const outcome = await runForcedUpdate(
    baseDeps({
      native: true,
      otaAvailable: true,
      ota: driver,
      isExamBusy: () => true,
      performReload: () => {
        reloaded = true;
      },
    })
  );

  assert.deepEqual(outcome, { kind: 'blocked', reasons: ['exam_active'] });
  assert.equal(calls.check, 0);
  assert.equal(calls.activate, 0);
  assert.equal(reloaded, false);
});

test('web: a newer deployment purges caches, reloads and returns the target build', async () => {
  let purged = 0;
  const captured: { pending: PendingReload | null } = { pending: null };

  const outcome = await runForcedUpdate(
    baseDeps({
      purgeCaches: async () => {
        purged += 1;
        return { deletedCaches: ['c'], skipped: false, workerActivated: false, workerChecked: false };
      },
      performReload: (value) => {
        captured.pending = value;
      },
    })
  );

  assert.equal(outcome.kind, 'reloaded');
  assert.equal(purged, 1);
  assert.equal(captured.pending?.targetBuildId, 'remote-build');
  assert.equal(captured.pending?.fromBuildId, 'local-build');
});

test('web: an up-to-date deployment does not purge or reload', async () => {
  let purged = 0;
  let reloaded = false;

  const outcome = await runForcedUpdate(
    baseDeps({
      checkManifest: async () => ({ ok: true, manifest: SAME_REMOTE, sourceUrl: 'https://x' }),
      purgeCaches: async () => {
        purged += 1;
        return { deletedCaches: [], skipped: true, workerActivated: false, workerChecked: false };
      },
      performReload: () => {
        reloaded = true;
      },
    })
  );

  assert.equal(outcome.kind, 'up_to_date');
  assert.equal(purged, 0);
  assert.equal(reloaded, false);
});

test('web: a server error never destroys caches', async () => {
  let purged = 0;

  const outcome = await runForcedUpdate(
    baseDeps({
      checkManifest: async () => ({ ok: false, reason: 'http_error', detail: 'HTTP 503' }),
      purgeCaches: async () => {
        purged += 1;
        return { deletedCaches: [], skipped: true, workerActivated: false, workerChecked: false };
      },
    })
  );

  assert.deepEqual(outcome, { kind: 'server_error', detail: 'http_error' });
  assert.equal(purged, 0);
});

test('web: an invalid manifest is a server error, not an update', async () => {
  const outcome = await runForcedUpdate(
    baseDeps({
      checkManifest: async () => ({ ok: false, reason: 'invalid_manifest' }),
    })
  );

  assert.equal(outcome.kind, 'server_error');
});

test('native OTA: up to date but a newer website build is reported honestly', async () => {
  const { driver, calls } = fakeOta({ phase: { phase: 'up_to_date' } });

  const outcome = await runForcedUpdate(
    baseDeps({ native: true, otaAvailable: true, ota: driver })
  );

  assert.equal(outcome.kind, 'up_to_date');
  assert.equal(outcome.kind === 'up_to_date' && outcome.webAhead, true);
  assert.equal(calls.initialize, 1);
  assert.deepEqual(calls.checks, [true]);
});

test('native OTA: a staged bundle is activated through the gate', async () => {
  const { driver, calls } = fakeOta({
    phase: { phase: 'staged', stagedVersion: '1.0.1-ota.production-android.nv1.0.0.db1' },
  });

  const outcome = await runForcedUpdate(
    baseDeps({ native: true, otaAvailable: true, ota: driver })
  );

  assert.equal(outcome.kind, 'ota_activated');
  assert.equal(calls.activate, 1);
});

test('native OTA: a gate block is surfaced, never forced through', async () => {
  const { driver, calls } = fakeOta({
    phase: {
      phase: 'activation_blocked',
      stagedVersion: '1.0.1-ota',
      reasons: ['pending_answers'],
    },
  });

  const outcome = await runForcedUpdate(
    baseDeps({ native: true, otaAvailable: true, ota: driver })
  );

  assert.deepEqual(outcome, { kind: 'blocked', reasons: ['pending_answers'] });
  assert.equal(calls.activate, 0);
});

test('native OTA: activation refused mid-flight is reported as blocked', async () => {
  const { driver } = fakeOta({
    phase: { phase: 'staged', stagedVersion: '1.0.1-ota' },
    decision: { allowed: false, reasons: ['submission_pending'] },
  });

  const outcome = await runForcedUpdate(
    baseDeps({ native: true, otaAvailable: true, ota: driver })
  );

  assert.deepEqual(outcome, { kind: 'blocked', reasons: ['submission_pending'] });
});

test('native OTA: a bundle built for a newer native app asks for an APK', async () => {
  const { driver } = fakeOta({
    phase: { phase: 'rejected', reasons: ['native_incompatible'] },
  });

  const outcome = await runForcedUpdate(
    baseDeps({ native: true, otaAvailable: true, ota: driver })
  );

  assert.equal(outcome.kind, 'apk_required');
  assert.equal(outcome.kind === 'apk_required' && outcome.reason, 'native_incompatible');
});

test('native OTA: an unreachable provider plus a different website build is a server error, not an APK requirement', async () => {
  const { driver } = fakeOta({
    phase: { phase: 'check_failed', error: 'null_channel_data' },
  });

  const outcome = await runForcedUpdate(
    baseDeps({
      native: true,
      otaAvailable: true,
      ota: driver,
      checkManifest: async () => ({
        ok: true,
        manifest: { ...REMOTE, version: BUILD.version },
        sourceUrl: 'https://x/version.json',
      }),
    })
  );

  assert.equal(outcome.kind, 'server_error');
});

test('native OTA: an unreachable provider requires an APK only when the native version floor proves incompatibility', async () => {
  const { driver } = fakeOta({
    phase: { phase: 'check_failed', error: 'network' },
  });

  const outcome = await runForcedUpdate(
    baseDeps({
      native: true,
      nativeVersion: '1.0.0',
      otaAvailable: true,
      ota: driver,
      checkManifest: async () => ({
        ok: true,
        manifest: { ...REMOTE, minNativeVersion: '1.1.0' },
        sourceUrl: 'https://x/version.json',
      }),
    })
  );

  assert.equal(outcome.kind, 'apk_required');
  assert.equal(outcome.kind === 'apk_required' && outcome.reason, 'native_incompatible');
});

test('native OTA: download failure does not imply an APK update when the native floor is compatible', async () => {
  const { driver } = fakeOta({
    phase: { phase: 'download_failed', error: 'network' },
  });

  const outcome = await runForcedUpdate(
    baseDeps({
      native: true,
      otaAvailable: true,
      ota: driver,
      checkManifest: async () => ({
        ok: true,
        manifest: { ...REMOTE, version: BUILD.version },
        sourceUrl: 'https://x/version.json',
      }),
    })
  );

  assert.equal(outcome.kind, 'server_error');
});

test('native OTA: compatibility uses installed APK version rather than frontend bundle version', async () => {
  const { driver } = fakeOta({
    phase: { phase: 'check_failed', error: 'network' },
  });

  const outcome = await runForcedUpdate(
    baseDeps({
      native: true,
      nativeVersion: '1.2.0',
      otaAvailable: true,
      ota: driver,
      checkManifest: async () => ({
        ok: true,
        manifest: { ...REMOTE, minNativeVersion: '1.1.0' },
        sourceUrl: 'https://x/version.json',
      }),
    })
  );

  assert.equal(outcome.kind, 'server_error');
});

test('native OTA: an unreachable provider with nothing newer is a server error', async () => {
  const { driver } = fakeOta({
    phase: { phase: 'check_failed', error: 'network' },
  });

  const outcome = await runForcedUpdate(
    baseDeps({
      native: true,
      otaAvailable: true,
      ota: driver,
      checkManifest: async () => ({ ok: true, manifest: SAME_REMOTE, sourceUrl: 'https://x' }),
    })
  );

  assert.equal(outcome.kind, 'server_error');
});

test('native without OTA: bundled assets cannot be replaced in-app', async () => {
  const outcome = await runForcedUpdate(baseDeps({ native: true, otaAvailable: false }));

  assert.equal(outcome.kind, 'apk_required');
  assert.equal(outcome.kind === 'apk_required' && outcome.reason, 'bundled_assets');
});

test('native without OTA: same build means up to date', async () => {
  const outcome = await runForcedUpdate(
    baseDeps({
      native: true,
      otaAvailable: false,
      checkManifest: async () => ({ ok: true, manifest: SAME_REMOTE, sourceUrl: 'https://x' }),
    })
  );

  assert.equal(outcome.kind, 'up_to_date');
});

test('an exception in the provider becomes a typed failure, not a crash', async () => {
  const { driver } = fakeOta({
    phase: { phase: 'staged', stagedVersion: '1.0.1-ota' },
    throwOnActivate: true,
  });

  const outcome = await runForcedUpdate(
    baseDeps({ native: true, otaAvailable: true, ota: driver })
  );

  assert.equal(outcome.kind, 'server_error');
});

test('the OTA check is always manual so backoff cannot block the user', async () => {
  const { driver, calls } = fakeOta({ phase: { phase: 'check_failed', error: 'x' } });

  await runForcedUpdate(baseDeps({ native: true, otaAvailable: true, ota: driver }));

  assert.deepEqual(calls.checks, [true]);
});
