import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_UPDATE_POLICY,
  decideUpdate,
  inRollout,
  normalizeUpdatePolicy,
  rolloutBucket,
  type UpdatePolicy,
  type VersionIdentity,
} from './versionPolicy';

const policy = (overrides: Partial<UpdatePolicy> = {}): UpdatePolicy => ({
  ...DEFAULT_UPDATE_POLICY,
  ...overrides,
});

const identity = (overrides: Partial<VersionIdentity> = {}): VersionIdentity => ({
  websiteVersion: '1.0.2',
  nativeVersion: '1.0.0',
  otaVersion: '1.0.2',
  native: true,
  deviceId: 'device-a',
  ...overrides,
});

test('nothing is enforced by default', () => {
  assert.deepEqual(decideUpdate(policy(), identity()), { kind: 'none' });
});

test('an old APK is blocked even when the OTA bundle is current', () => {
  // This is the regression the old SystemGuard had: it compared the web bundle
  // version, so a current OTA bundle hid an outdated APK.
  const decision = decideUpdate(
    policy({
      enforce_apk_update: true,
      min_native_version: '1.2.0',
      apk_download_url: 'https://porokhbd.vercel.app/app.apk',
    }),
    identity({ nativeVersion: '1.0.0', otaVersion: '9.9.9' })
  );

  assert.equal(decision.kind, 'mandatory_apk');
  if (decision.kind === 'mandatory_apk') {
    assert.equal(decision.minVersion, '1.2.0');
    assert.equal(decision.apkUrl, 'https://porokhbd.vercel.app/app.apk');
  }
});

test('a current APK clears the APK requirement', () => {
  const decision = decideUpdate(
    policy({ enforce_apk_update: true, min_native_version: '1.2.0' }),
    identity({ nativeVersion: '1.2.0' })
  );

  assert.equal(decision.kind, 'none');
});

test('an old OTA bundle is blocked without touching the APK requirement', () => {
  const decision = decideUpdate(
    policy({ enforce_ota_update: true, min_ota_version: '1.3.0' }),
    identity({ nativeVersion: '2.0.0', otaVersion: '1.0.2' })
  );

  assert.equal(decision.kind, 'mandatory_ota');
  if (decision.kind === 'mandatory_ota') assert.equal(decision.minVersion, '1.3.0');
});

test('the OTA check compares the base version of a full release string', () => {
  const decision = decideUpdate(
    policy({ enforce_ota_update: true, min_ota_version: '1.3.0' }),
    identity({
      otaVersion: '1.3.0-ota.production-android.r000042.nv1.2.0.db2',
    })
  );

  assert.equal(decision.kind, 'none');
});

test('an unidentified OTA bundle never blocks the app', () => {
  const decision = decideUpdate(
    policy({ enforce_ota_update: true, min_ota_version: '9.0.0' }),
    identity({ otaVersion: null })
  );

  assert.equal(decision.kind, 'none');
});

test('an unidentified native version never blocks the app', () => {
  const decision = decideUpdate(
    policy({ enforce_apk_update: true, min_native_version: '9.0.0' }),
    identity({ nativeVersion: null })
  );

  assert.equal(decision.kind, 'none');
});

test('the APK requirement outranks the OTA requirement', () => {
  const decision = decideUpdate(
    policy({
      enforce_apk_update: true,
      min_native_version: '2.0.0',
      enforce_ota_update: true,
      min_ota_version: '2.0.0',
    }),
    identity({ nativeVersion: '1.0.0', otaVersion: '1.0.0' })
  );

  assert.equal(decision.kind, 'mandatory_apk');
});

test('the browser is never blocked by a native or OTA policy', () => {
  const decision = decideUpdate(
    policy({
      enforce_apk_update: true,
      min_native_version: '9.0.0',
      enforce_ota_update: true,
      min_ota_version: '9.0.0',
    }),
    identity({ native: false, nativeVersion: null, otaVersion: null })
  );

  assert.equal(decision.kind, 'none');
});

test('an optional prompt targets an older APK within the rollout', () => {
  const decision = decideUpdate(
    policy({
      optional_update_enabled: true,
      latest_native_version: '1.4.0',
      optional_update_title: 'New version',
      rollout_percentage: 100,
    }),
    identity({ nativeVersion: '1.2.0' })
  );

  assert.equal(decision.kind, 'optional_update');
  if (decision.kind === 'optional_update') {
    assert.equal(decision.targetVersion, '1.4.0');
    assert.equal(decision.title, 'New version');
  }
});

test('a mandatory policy ignores the rollout percentage', () => {
  const decision = decideUpdate(
    policy({
      enforce_apk_update: true,
      min_native_version: '2.0.0',
      rollout_percentage: 0,
    }),
    identity({ nativeVersion: '1.0.0' })
  );

  assert.equal(decision.kind, 'mandatory_apk');
});

test('rollout bucketing is deterministic and bounded', () => {
  const bucket = rolloutBucket('device-a');
  assert.equal(bucket, rolloutBucket('device-a'));
  assert.ok(bucket >= 0 && bucket < 100);
});

test('a 0 percent rollout suppresses the optional prompt', () => {
  assert.equal(inRollout(policy({ rollout_percentage: 0 }), 'device-a'), false);
  assert.equal(inRollout(policy({ rollout_percentage: 100 }), 'device-a'), true);
});

test('a missing policy document normalises to no enforcement', () => {
  assert.deepEqual(normalizeUpdatePolicy(null), DEFAULT_UPDATE_POLICY);
  assert.deepEqual(normalizeUpdatePolicy(undefined), DEFAULT_UPDATE_POLICY);
});

test('a malformed policy document degrades each field independently', () => {
  const parsed = normalizeUpdatePolicy({
    enforce_apk_update: 'yes',
    min_native_version: 42,
    rollout_percentage: 900,
  });

  assert.equal(parsed.enforce_apk_update, false);
  assert.equal(parsed.min_native_version, '');
  assert.equal(parsed.rollout_percentage, 100);
});
