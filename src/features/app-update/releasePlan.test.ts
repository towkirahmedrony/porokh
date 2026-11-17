import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatRevision,
  parseGradleVersionCode,
  parseGradleVersionName,
  resolveReleasePlan,
} from './releasePlan.ts';
import { parseReleaseVersion, compareReleaseVersions } from './version.ts';
import { OFFLINE_SCHEMA_VERSION } from '../exam/offline/schemaVersion.ts';

const base = {
  baseVersion: '1.0.0',
  channel: 'production-android',
  revision: 120,
  minNativeVersion: '1.0.0',
  nativeVersionName: '1.0.0',
};

const plan = (overrides: Partial<typeof base> = {}) => {
  const result = resolveReleasePlan({ ...base, ...overrides });
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.ok ? result.plan : (undefined as never);
};

test('the same commit always produces the same version', () => {
  assert.equal(plan().version, plan().version);
  assert.equal(plan().version, '1.0.0-ota.production-android.r000120.nv1.0.0.db2');
});

test('sequential releases are unique and strictly increasing', () => {
  const versions = [120, 121, 122, 1000, 1001].map(
    (revision) => plan({ revision }).version
  );

  assert.equal(new Set(versions).size, versions.length, 'versions must be unique');

  for (let index = 1; index < versions.length; index += 1) {
    const order = compareReleaseVersions(versions[index], versions[index - 1]);
    assert.equal(order, 1, `${versions[index]} must sort after ${versions[index - 1]}`);
  }
});

test('a branch build of the same source version still differs from main', () => {
  const main = plan({ revision: 300 }).version;
  const branch = plan({ revision: 187 }).version;

  assert.notEqual(main, branch);
  assert.equal(parseReleaseVersion(main)?.baseVersion, '1.0.0');
  assert.equal(parseReleaseVersion(branch)?.baseVersion, '1.0.0');
});

test('a frontend-only release stays installable on the APK already in the field', () => {
  for (const baseVersion of ['1.0.0', '1.0.3', '1.2.0']) {
    const resolved = plan({ baseVersion, revision: 400 });
    const metadata = parseReleaseVersion(resolved.version);
    assert.ok(metadata);
    // nv is the policy value from ota.config.json, not the base version.
    assert.equal(metadata.minNativeVersion, '1.0.0');
    assert.equal(metadata.requiredSchemaVersion, OFFLINE_SCHEMA_VERSION);
  }
});

test('a release may not demand a native build newer than the one being shipped', () => {
  const result = resolveReleasePlan({
    ...base,
    minNativeVersion: '1.1.0',
    nativeVersionName: '1.0.0',
  });

  assert.equal(result.ok, false);
  assert.ok(
    !result.ok && result.problems.some((p) => p.code === 'min_native_ahead_of_native')
  );
});

test('min native below the native versionName is allowed (older APKs supported)', () => {
  const resolved = plan({ minNativeVersion: '0.9.0', nativeVersionName: '1.0.0' });
  assert.equal(parseReleaseVersion(resolved.version)?.minNativeVersion, '0.9.0');
});

test('a duplicate version is refused before publication', () => {
  const version = plan().version;
  const result = resolveReleasePlan({ ...base, knownVersions: [version] });

  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.problems.some((p) => p.code === 'duplicate_version'));
});

test('a release that does not sort after the last published one is refused', () => {
  const older = plan({ revision: 200 }).version;
  const result = resolveReleasePlan({ ...base, lastPublishedVersion: older });

  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.problems.some((p) => p.code === 'not_increasing'));

  const same = resolveReleasePlan({ ...base, lastPublishedVersion: plan().version });
  assert.equal(same.ok, false, 'republishing the same version is not increasing');
});

test('a higher base version always sorts above a lower one regardless of revision', () => {
  const result = resolveReleasePlan({
    ...base,
    baseVersion: '1.0.1',
    revision: 1,
    lastPublishedVersion: plan({ revision: 999_999 }).version,
  });

  assert.equal(result.ok, true);
});

test('invalid inputs are reported, not silently coerced', () => {
  const cases: Array<[Partial<typeof base>, string]> = [
    [{ baseVersion: '1.0' }, 'invalid_base_version'],
    [{ revision: 0 }, 'invalid_revision'],
    [{ revision: -3 }, 'invalid_revision'],
    [{ minNativeVersion: 'one' }, 'invalid_min_native'],
  ];

  for (const [overrides, code] of cases) {
    const result = resolveReleasePlan({ ...base, ...overrides });
    assert.equal(result.ok, false, code);
    assert.ok(!result.ok && result.problems.some((p) => p.code === code), code);
  }
});

test('the schema version defaults to the compiled client constant', () => {
  const result = resolveReleasePlan({
    baseVersion: '1.0.0',
    channel: 'production-android',
    revision: 1,
    minNativeVersion: '1.0.0',
    nativeVersionName: '1.0.0',
  });

  assert.equal(result.ok, true);
  assert.equal(
    result.ok ? result.plan.schemaVersion : null,
    OFFLINE_SCHEMA_VERSION
  );
});

test('gradle parsing reads the packaged versionName and versionCode', () => {
  const gradle = [
    'android {',
    '  defaultConfig {',
    '    versionCode 10000',
    '    versionName "1.0.0"',
    '  }',
    '}',
  ].join('\n');

  assert.equal(parseGradleVersionName(gradle), '1.0.0');
  assert.equal(parseGradleVersionCode(gradle), 10000);
  assert.equal(parseGradleVersionName('nothing here'), null);
});

test('revisions are formatted to a fixed width so lexical order is numeric order', () => {
  assert.equal(formatRevision(7), '000007');
  assert.equal(formatRevision(999_999), '999999');
  assert.ok(formatRevision(999) < formatRevision(1000));
});
