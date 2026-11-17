import test from 'node:test';
import assert from 'node:assert/strict';

import {
  baseVersionOf,
  buildReleaseVersion,
  classifyChecksum,
  compareNumericVersions,
  compareReleaseVersions,
  isHttpsUrl,
  isNativeVersionCompatible,
  isPlainChecksum,
  isSchemaVersionCompatible,
  isSignedChecksum,
  isValidSessionKey,
  parseReleaseVersion,
  sameChecksum,
  verifyReleaseSignature,
} from './version.ts';

const SHA256 = 'a'.repeat(64);
/** RSA-2048 block, hex encoded: 256 bytes → 512 characters. */
const SIGNED = 'b'.repeat(512);

test('release version round-trips revision, channel, native minimum and schema', () => {
  const version = buildReleaseVersion({
    baseVersion: '1.4.0',
    channel: 'production-android',
    revision: 42,
    minNativeVersion: '1.0.0',
    requiredSchemaVersion: 2,
  });

  assert.equal(
    version,
    '1.4.0-ota.production-android.r000042.nv1.0.0.db2'
  );
  assert.deepEqual(parseReleaseVersion(version), {
    baseVersion: '1.4.0',
    channel: 'production-android',
    revision: 42,
    minNativeVersion: '1.0.0',
    requiredSchemaVersion: 2,
  });
});

test('the release revision is zero padded so string order matches numeric order', () => {
  const versions = [9, 10, 99, 100, 1000, 99999].map((revision) =>
    buildReleaseVersion({
      baseVersion: '1.0.0',
      channel: 'production-android',
      revision,
      minNativeVersion: '1.0.0',
      requiredSchemaVersion: 2,
    })
  );

  assert.deepEqual([...versions].sort(), versions);
  assert.ok(versions[0].includes('.r000009.'));
  assert.ok(versions[1].includes('.r000010.'));
});

test('parse rejects malformed OTA versions and accepts the legacy layout', () => {
  assert.equal(parseReleaseVersion('1.4.0'), null);
  assert.equal(parseReleaseVersion('1.4.0-ota.production-android.db1'), null);
  assert.equal(parseReleaseVersion('1.4.0-ota.staging.nv1.2.db2.extra'), null);
  assert.equal(parseReleaseVersion('1.4-ota.production-android.nv1.0.0.db1'), null);
  assert.equal(parseReleaseVersion('1.4.0-ota..nv1.0.0.db1'), null);
  assert.equal(
    parseReleaseVersion('1.4.0-ota.production-android.r12.nv1.0.0.db1'),
    null,
    'a revision must be zero padded to six digits'
  );

  // Bundles published by the previous scheme have no revision field.
  assert.deepEqual(parseReleaseVersion('1.4.0-ota.production-android.nv1.2.0.db1'), {
    baseVersion: '1.4.0',
    channel: 'production-android',
    revision: null,
    minNativeVersion: '1.2.0',
    requiredSchemaVersion: 1,
  });
});

test('build rejects invalid inputs', () => {
  const base = {
    baseVersion: '1.4.0',
    channel: 'production-android',
    revision: 1,
    minNativeVersion: '1.0.0',
    requiredSchemaVersion: 2,
  };

  assert.throws(() => buildReleaseVersion({ ...base, baseVersion: '1.4' }));
  assert.throws(() => buildReleaseVersion({ ...base, channel: 'Production Android' }));
  assert.throws(() => buildReleaseVersion({ ...base, minNativeVersion: 'v1' }));
  assert.throws(() => buildReleaseVersion({ ...base, requiredSchemaVersion: 0 }));
  assert.throws(() => buildReleaseVersion({ ...base, revision: 0 }));
  assert.throws(() => buildReleaseVersion({ ...base, revision: 1_000_000 }));
  assert.throws(() => buildReleaseVersion({ ...base, revision: 1.5 }));
});

test('native versions compare numerically, not lexically', () => {
  assert.equal(compareNumericVersions('1.10.0', '1.9.9'), 1);
  assert.equal(compareNumericVersions('1.0', '1.0.0'), 0);
  assert.equal(compareNumericVersions('2', '1.99.99'), 1);
  assert.equal(compareNumericVersions('broken', '1.0.0'), null);
  assert.equal(isNativeVersionCompatible('1.2.0', '1.2.0'), true);
  assert.equal(isNativeVersionCompatible('1.3.0', '1.2.0'), true);
  assert.equal(isNativeVersionCompatible('1.1.9', '1.2.0'), false);
  assert.equal(isNativeVersionCompatible(null, '1.2.0'), false);
});

test('an installed 1.0.0 APK stays compatible with later frontend-only releases', () => {
  // The old scheme derived the native minimum from the base version, so a
  // frontend-only 1.0.1 bundle demanded an APK that did not exist. The native
  // requirement is now independent of the base version.
  const installedNative = '1.0.0';

  for (const baseVersion of ['1.0.0', '1.0.1', '1.1.0', '2.0.0']) {
    const version = buildReleaseVersion({
      baseVersion,
      channel: 'production-android',
      revision: 7,
      minNativeVersion: '1.0.0',
      requiredSchemaVersion: 2,
    });
    const metadata = parseReleaseVersion(version);
    assert.ok(metadata);
    assert.equal(
      isNativeVersionCompatible(installedNative, metadata.minNativeVersion),
      true,
      `${baseVersion} must stay installable on a 1.0.0 APK`
    );
  }

  // And the requirement still works when it is deliberately raised.
  const raised = parseReleaseVersion(
    buildReleaseVersion({
      baseVersion: '1.1.0',
      channel: 'production-android',
      revision: 8,
      minNativeVersion: '1.1.0',
      requiredSchemaVersion: 2,
    })
  );
  assert.ok(raised);
  assert.equal(
    isNativeVersionCompatible(installedNative, raised.minNativeVersion),
    false
  );
});

test('release versions order by base then revision', () => {
  const at = (base: string, revision: number | null): string =>
    revision === null
      ? `${base}-ota.production-android.nv1.0.0.db2`
      : `${base}-ota.production-android.r${String(revision).padStart(6, '0')}.nv1.0.0.db2`;

  assert.equal(compareReleaseVersions(at('1.0.0', 5), at('1.0.0', 6)), -1);
  assert.equal(compareReleaseVersions(at('1.0.0', 6), at('1.0.0', 6)), 0);
  assert.equal(compareReleaseVersions(at('1.0.1', 1), at('1.0.0', 999)), 1);
  assert.equal(compareReleaseVersions(at('1.0.0', 10), at('1.0.0', 9)), 1);
  // Legacy bundles (no revision) sort below a revisioned release of the same base.
  assert.equal(compareReleaseVersions(at('1.0.0', null), at('1.0.0', 1)), -1);
  assert.equal(compareReleaseVersions('nonsense', at('1.0.0', 1)), null);
});

test('schema compatibility is exact, never a range', () => {
  assert.equal(isSchemaVersionCompatible(2, 2), true);
  assert.equal(isSchemaVersionCompatible(2, 1), false);
  assert.equal(isSchemaVersionCompatible(0, 1), false);
  assert.equal(isSchemaVersionCompatible(1.5, 1), false);
});

test('base version extraction works for plain and OTA versions', () => {
  assert.equal(baseVersionOf('1.0.0'), '1.0.0');
  assert.equal(
    baseVersionOf('1.4.0-ota.production-android.r000042.nv1.2.0.db2'),
    '1.4.0'
  );
  assert.equal(
    baseVersionOf('1.4.0-ota.production-android.nv1.2.0.db1'),
    '1.4.0'
  );
  assert.equal(baseVersionOf('nonsense'), null);
  assert.equal(baseVersionOf(null), null);
});

test('download URLs must be https and checksums compare case-insensitively', () => {
  assert.equal(isHttpsUrl('https://example.com/bundle.zip'), true);
  assert.equal(isHttpsUrl('http://example.com/bundle.zip'), false);
  assert.equal(isHttpsUrl('/bundle.zip'), false);
  assert.equal(sameChecksum('ABCDEF', 'abcdef'), true);
  assert.equal(sameChecksum('abc', 'abd'), false);
});

test('checksum shapes distinguish a clear release from a signed one', () => {
  assert.equal(isPlainChecksum(SHA256), true);
  assert.equal(isPlainChecksum(SHA256.toUpperCase()), true);
  assert.equal(isPlainChecksum('a'.repeat(63)), false);
  assert.equal(isPlainChecksum(SIGNED), false);

  assert.equal(isSignedChecksum(SIGNED), true);
  assert.equal(isSignedChecksum(SHA256), false);
  assert.equal(isSignedChecksum('not-hex'), false);

  assert.equal(classifyChecksum(SHA256), 'plain');
  assert.equal(classifyChecksum(SIGNED), 'signed');
  assert.equal(classifyChecksum(''), 'unknown');
});

test('session keys must look like iv:key', () => {
  assert.equal(isValidSessionKey('aXY=:c2Vzc2lvbg=='), true);
  assert.equal(isValidSessionKey(''), false);
  assert.equal(isValidSessionKey(null), false);
  assert.equal(isValidSessionKey('no-colon'), false);
  assert.equal(isValidSessionKey(':key'), false);
  assert.equal(isValidSessionKey('iv:'), false);
  assert.equal(isValidSessionKey('a:b:c'), false);
});

test('an unsigned or partially signed release never passes the signature check', () => {
  assert.deepEqual(verifyReleaseSignature({ checksum: SIGNED, sessionKey: 'a:b' }), {
    ok: true,
  });

  assert.deepEqual(verifyReleaseSignature({ checksum: SHA256, sessionKey: 'a:b' }), {
    ok: false,
    reason: 'unsigned_checksum',
  });

  assert.deepEqual(verifyReleaseSignature({ checksum: SIGNED }), {
    ok: false,
    reason: 'missing_session_key',
  });

  assert.deepEqual(verifyReleaseSignature({ checksum: SIGNED, sessionKey: '' }), {
    ok: false,
    reason: 'missing_session_key',
  });

  assert.deepEqual(
    verifyReleaseSignature({ checksum: '', sessionKey: undefined }),
    { ok: false, reason: 'missing_session_key' }
  );
});
