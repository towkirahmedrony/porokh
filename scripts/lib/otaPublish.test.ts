import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';

import {
  PublishProblem,
  assertChannel,
  assertPointerMove,
  assertRevision,
  assetNames,
  buildPointer,
  bundleBaseName,
  channelPointerPath,
  manifestDocument,
  nextGeneration,
  releaseAssetUrl,
  releaseTag,
  sha256Sums,
  signatureDocument,
  verifyChannelPointerSignature,
} from './otaPublish.ts';
import { parseChannelPointer, pointerPayload } from '../../src/features/app-update/githubManifest.ts';
import type { ChannelPointer } from '../../src/features/app-update/githubManifest.ts';
import { buildReleaseVersion } from '../../src/features/app-update/version.ts';

const REPO = 'towkirahmedrony/porokh-ota';
const REVISION = 123;
const VERSION = buildReleaseVersion({
  baseVersion: '1.0.2',
  channel: 'production-android',
  revision: REVISION,
  minNativeVersion: '1.0.1',
  requiredSchemaVersion: 2,
});

const draft = () => ({
  channel: 'production-android',
  version: VERSION,
  url: releaseAssetUrl({
    repo: REPO,
    channel: 'production-android',
    revision: REVISION,
    asset: assetNames({
      channel: 'production-android',
      baseVersion: '1.0.2',
      revision: REVISION,
    }).encrypted,
  }),
  checksum: 'c'.repeat(512),
  sessionKey: 'aXY=:c2Vzc2lvbg==',
  minNativeVersion: '1.0.1',
  requiredSchemaVersion: 2,
  revision: REVISION,
  generation: 5,
  publishedAt: '2026-11-01T00:00:00.000Z',
  notes: 'Git abc1234',
});

test('release tags and assets are derived from the revision only', () => {
  assert.equal(releaseTag('production-android', 123), 'ota-production-android-r000123');
  assert.equal(releaseTag('staging-android', 7), 'ota-staging-android-r000007');

  const names = assetNames({
    channel: 'production-android',
    baseVersion: '1.0.2',
    revision: REVISION,
  });
  assert.equal(names.encrypted, 'porokh-production-android-1.0.2-r000123.zip.enc');
  assert.equal(names.manifest, 'manifest.json');
  assert.equal(names.manifestSignature, 'manifest.json.sig');
  assert.equal(names.checksums, 'SHA256SUMS');
  assert.equal(
    bundleBaseName('production-android', '1.0.2', REVISION),
    'porokh-production-android-1.0.2-r000123'
  );
});

test('asset URLs point at the immutable release download path', () => {
  assert.equal(
    releaseAssetUrl({
      repo: REPO,
      channel: 'production-android',
      revision: REVISION,
      asset: 'porokh-production-android-1.0.2-r000123.zip.enc',
    }),
    'https://github.com/towkirahmedrony/porokh-ota/releases/download/' +
      'ota-production-android-r000123/porokh-production-android-1.0.2-r000123.zip.enc'
  );
});

test('production and staging can never share a pointer, tag or asset', () => {
  assert.equal(channelPointerPath('production-android'), 'channels/production-android.json');
  assert.equal(channelPointerPath('staging-android'), 'channels/staging-android.json');

  const staging = assetNames({
    channel: 'staging-android',
    baseVersion: '1.0.2',
    revision: REVISION,
  });
  assert.match(staging.encrypted, /^porokh-staging-android-/);
  assert.notEqual(releaseTag('staging-android', REVISION), releaseTag('production-android', REVISION));
});

test('unknown or unsafe channel names are refused before they become paths', () => {
  assert.equal(assertChannel('production-android'), 'production-android');
  assert.equal(assertChannel('staging-android'), 'staging-android');

  for (const value of ['', '../main', 'production', 'production-android/../x', 'PRODUCTION']) {
    assert.throws(() => assertChannel(value), PublishProblem, value);
  }
});

test('the built pointer round-trips through the client parser', () => {
  const pointer = buildPointer(draft());
  const parsed = parseChannelPointer(pointer, { channel: 'production-android' });

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.pointer.version, VERSION);
  assert.equal(parsed.pointer.revision, REVISION);
  assert.equal(parsed.pointer.generation, 5);
  // The signature covers exactly these bytes.
  assert.equal(pointerPayload(parsed.pointer), pointerPayload(pointer));
});

test('the pointer generation only ever increases', () => {
  assert.equal(nextGeneration(null), 1);
  assert.equal(nextGeneration({ generation: 1 }), 2);
  assert.equal(nextGeneration({ generation: 41 }), 42);
  assert.throws(() => nextGeneration({ generation: -1 }), PublishProblem);
  assert.throws(
    () => nextGeneration({ generation: Number.MAX_SAFE_INTEGER }),
    /cannot be incremented safely/
  );
});

test('publisher verifies current and rollback pointers with a real Ed25519 signature', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const pointer = buildPointer(draft());
  const signature = sign(
    null,
    Buffer.from(pointerPayload(pointer), 'utf8'),
    privateKey
  ).toString('base64');

  assert.equal(
    verifyChannelPointerSignature({ pointer, signature, publicKey }),
    true
  );
  assert.equal(
    verifyChannelPointerSignature({
      pointer: { ...pointer, notes: 'tampered' },
      signature,
      publicKey,
    }),
    false
  );
  assert.equal(
    verifyChannelPointerSignature({ pointer, signature: 'not-base64', publicKey }),
    false
  );
});

test('a pointer move must advance the generation', () => {
  const current = buildPointer({ ...draft(), generation: 5 });

  assert.throws(
    () => assertPointerMove({ next: buildPointer({ ...draft(), generation: 5 }), current, allowRollback: false }),
    PublishProblem
  );
  assert.throws(
    () => assertPointerMove({ next: buildPointer({ ...draft(), generation: 4 }), current, allowRollback: true }),
    PublishProblem
  );
  assert.doesNotThrow(() =>
    assertPointerMove({ next: buildPointer({ ...draft(), generation: 6 }), current, allowRollback: false })
  );
});

test('a backwards revision needs an explicit rollback', () => {
  const current = buildPointer({ ...draft(), revision: 130, generation: 5 });
  const older = buildPointer({ ...draft(), revision: 120, generation: 6 });

  assert.throws(
    () => assertPointerMove({ next: older, current, allowRollback: false }),
    PublishProblem
  );
  assert.doesNotThrow(() =>
    assertPointerMove({ next: older, current, allowRollback: true })
  );
});

test('a pointer can never change channel', () => {
  const current = buildPointer({ ...draft(), generation: 5 });
  const other = buildPointer({ ...draft(), channel: 'staging-android', generation: 6 });

  assert.throws(
    () => assertPointerMove({ next: other, current, allowRollback: true }),
    PublishProblem
  );
});

test('revisions must be positive and within the version scheme', () => {
  assert.equal(assertRevision(1), 1);
  for (const value of [0, -1, 1.5, 1_000_000]) {
    assert.throws(() => assertRevision(value), PublishProblem, String(value));
  }
});

test('checksums are published in a `sha256sum -c` compatible listing', () => {
  assert.equal(
    sha256Sums([
      { name: 'a.zip.enc', sha256: 'a'.repeat(64) },
      { name: 'manifest.json', sha256: 'b'.repeat(64) },
    ]),
    `${'a'.repeat(64)}  a.zip.enc\n${'b'.repeat(64)}  manifest.json\n`
  );
});

test('the manifest asset carries the same signed document as the pointer', () => {
  const pointer: ChannelPointer = buildPointer(draft());
  const signature = Buffer.alloc(64, 9);
  const parsed = JSON.parse(manifestDocument(pointer, signature)) as ChannelPointer & {
    signature?: string;
  };

  assert.equal(parsed.version, pointer.version);
  assert.equal(parsed.checksum, pointer.checksum);
  assert.equal(parsed.generation, pointer.generation);
  assert.equal(pointerPayload(parsed), pointerPayload(pointer));
  // A release asset must be re-verifiable on its own, which is what lets a
  // rollback refuse a manifest that was not signed by the OTA key.
  assert.equal(parsed.signature, signature.toString('base64'));
  const reParsed = parseChannelPointer(parsed, { channel: 'production-android' });
  assert.equal(reParsed.ok, true);
  if (!reParsed.ok) return;
  assert.equal(reParsed.signature, signature.toString('base64'));
});

test('signatures are published base64 encoded on one line', () => {
  const document = signatureDocument(Buffer.alloc(64, 7));
  assert.equal(document, `${Buffer.alloc(64, 7).toString('base64')}\n`);
  assert.equal(Buffer.from(document.trim(), 'base64').length, 64);
});
