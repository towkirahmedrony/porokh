import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
} from 'node:crypto';

import {
  POINTER_SCHEMA,
  base64ToBytes,
  channelPointerUrl,
  createWebCryptoEd25519Verifier,
  fetchChannelLatest,
  parseChannelPointer,
  pointerPayload,
  pointerProblemReason,
  type ChannelPointer,
  type Ed25519Verifier,
} from './githubManifest.ts';
import { buildReleaseVersion } from './version.ts';

const CHANNEL = 'production-android';
const REVISION = 123;
const VERSION = buildReleaseVersion({
  baseVersion: '1.0.2',
  channel: CHANNEL,
  revision: REVISION,
  minNativeVersion: '1.0.1',
  requiredSchemaVersion: 2,
});
const ASSET_URL =
  'https://github.com/towkirahmedrony/porokh-ota/releases/download/' +
  'ota-production-android-r000123/porokh-production-android-1.0.2-r000123.zip.enc';
/** RSA key-v2 signed checksum: a 2048-bit block, hex encoded. */
const SIGNED_CHECKSUM = 'b'.repeat(512);
const SESSION_KEY = 'aXY=aXY=:c2Vzc2lvbmV5'.replace('aXY=aXY=', 'aXY=');

const pointer = (overrides: Partial<ChannelPointer> = {}): ChannelPointer => ({
  schema: POINTER_SCHEMA,
  channel: CHANNEL,
  version: VERSION,
  url: ASSET_URL,
  checksum: SIGNED_CHECKSUM,
  sessionKey: SESSION_KEY,
  minNativeVersion: '1.0.1',
  requiredSchemaVersion: 2,
  revision: REVISION,
  generation: 4,
  publishedAt: '2026-11-01T00:00:00.000Z',
  notes: 'Git abc1234',
  ...overrides,
});

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const rawPublicKey = (
  publicKey.export({ type: 'spki', format: 'der' }) as Buffer
).subarray(-32);
const PUBLIC_KEY_BASE64 = rawPublicKey.toString('base64');

const signPointer = (value: ChannelPointer = pointer()): string =>
  sign(null, Buffer.from(pointerPayload(value), 'utf8'), privateKey).toString(
    'base64'
  );

/**
 * Real Ed25519 verification through OpenSSL, used so the canonical-payload and
 * signature-bytes handling is exercised on every Node version. It swaps only the
 * Web Crypto call surface, not the cryptographic primitive.
 */
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const nodeVerifier: Ed25519Verifier = async (payload, signature, key) => {
  const keyObject = createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(key)]),
    format: 'der',
    type: 'spki',
  });
  return verify(null, Buffer.from(payload), keyObject, Buffer.from(signature));
};

const respond = (
  body: unknown,
  init: { ok?: boolean; status?: number } = {}
): {
  impl: (
    url: string,
    options?: Record<string, unknown>
  ) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;
  calls: Array<{ url: string; options?: Record<string, unknown> }>;
} => {
  const calls: Array<{ url: string; options?: Record<string, unknown> }> = [];
  const impl = async (url: string, options?: Record<string, unknown>) => {
    calls.push({ url, options });
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return {
      ok: init.ok ?? true,
      status: init.status ?? 200,
      text: async () => text,
    };
  };
  return { impl, calls };
};

const latest = (options: Parameters<typeof fetchChannelLatest>[0] = { channel: CHANNEL }) => options;

/* ---------------------------- location ---------------------------- */

test('pointers live under the public distribution repository', () => {
  assert.equal(
    channelPointerUrl(CHANNEL),
    'https://raw.githubusercontent.com/towkirahmedrony/porokh-ota/main/channels/production-android.json'
  );
  assert.equal(
    channelPointerUrl('staging-android'),
    'https://raw.githubusercontent.com/towkirahmedrony/porokh-ota/main/channels/staging-android.json'
  );
});

/* ----------------------------- parsing ---------------------------- */

test('a well-formed pointer is accepted and maps to the provider contract', async () => {
  const body = { ...pointer(), signature: signPointer() };
  const { impl, calls } = respond(body);

  const result = await fetchChannelLatest(
    latest({
      channel: CHANNEL,
      requireSignature: true,
      publicKeyBase64: PUBLIC_KEY_BASE64,
      verifier: nodeVerifier,
      fetchImpl: impl,
    })
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.latest.version, VERSION);
  assert.equal(result.latest.url, ASSET_URL);
  assert.equal(result.latest.checksum, SIGNED_CHECKSUM);
  assert.equal(result.latest.sessionKey, SESSION_KEY);
  // Never cached: a stale pointer is exactly the failure mode this replaces.
  assert.equal(calls[0]?.options?.cache, 'no-store');
  assert.equal(calls[0]?.options?.credentials, 'omit');
});

test('a pointer for another channel is rejected, not retried', () => {
  const result = parseChannelPointer(pointer({ channel: 'staging-android' }), {
    channel: CHANNEL,
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.problem, 'channel_mismatch');
  assert.equal(pointerProblemReason(result.problem), 'channel_mismatch');
});

test('a pointer whose version disagrees with its fields is rejected', () => {
  // Revision in the version string vs. the revision field.
  const result = parseChannelPointer(pointer({ revision: REVISION + 1 }), {
    channel: CHANNEL,
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.problem, 'invalid_pointer');
});

test('the native floor and schema in the version must match the pointer', () => {
  for (const overrides of [
    { minNativeVersion: '1.0.0' },
    { requiredSchemaVersion: 3 },
  ]) {
    const result = parseChannelPointer(pointer(overrides), { channel: CHANNEL });
    assert.equal(result.ok, false, JSON.stringify(overrides));
  }
});

test('malformed pointers are rejected instead of trusted', () => {
  const bad: unknown[] = [
    null,
    [],
    'pointer',
    {},
    { ...pointer(), schema: POINTER_SCHEMA + 1 },
    { ...pointer(), version: 'not a version' },
    { ...pointer(), revision: 0 },
    { ...pointer(), revision: 999_999_9 },
    { ...pointer(), generation: 0 },
    { ...pointer(), requiredSchemaVersion: 0 },
    { ...pointer(), minNativeVersion: 'v1' },
    { ...pointer(), publishedAt: 'yesterday' },
    { ...pointer(), notes: 'x'.repeat(501) },
    { ...pointer(), channel: '../production-android' },
  ];

  for (const value of bad) {
    const result = parseChannelPointer(value, { channel: CHANNEL });
    assert.equal(result.ok, false, `accepted ${JSON.stringify(value)}`);
  }
});

test('only https bundle URLs inside the distribution release prefix are accepted', () => {
  const cases = [
    'http://github.com/towkirahmedrony/porokh-ota/releases/download/x/y.zip.enc',
    'https://evil.example.com/porokh-production-android.zip.enc',
    'https://github.com/attacker/porokh-ota/releases/download/x/y.zip.enc',
    'javascript:alert(1)',
  ];

  for (const url of cases) {
    const result = parseChannelPointer(pointer({ url }), { channel: CHANNEL });
    assert.equal(result.ok, false, `accepted ${url}`);
    if (result.ok) continue;
    assert.equal(result.problem, 'unsafe_url');
    assert.equal(pointerProblemReason(result.problem), 'metadata_invalid');
  }
});

test('a clear-bundle checksum is rejected: only RSA-signed releases are publishable', () => {
  const result = parseChannelPointer(pointer({ checksum: 'a'.repeat(64) }), {
    channel: CHANNEL,
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.problem, 'invalid_pointer');
});

test('a malformed session key is rejected', () => {
  for (const sessionKey of ['', 'sessionkey', 'a:b:c', 'not base64!:aXY=']) {
    const result = parseChannelPointer(pointer({ sessionKey }), { channel: CHANNEL });
    assert.equal(result.ok, false, `accepted session key "${sessionKey}"`);
  }
});

/* ---------------------------- signatures -------------------------- */

test('a valid Ed25519 signature is required when signature enforcement is on', async () => {
  const signed = { ...pointer(), signature: signPointer() };
  const ok = await fetchChannelLatest(
    latest({
      channel: CHANNEL,
      requireSignature: true,
      publicKeyBase64: PUBLIC_KEY_BASE64,
      verifier: nodeVerifier,
      fetchImpl: respond(signed).impl,
    })
  );
  assert.equal(ok.ok, true);

  const missing = await fetchChannelLatest({
    channel: CHANNEL,
    requireSignature: true,
    publicKeyBase64: PUBLIC_KEY_BASE64,
    verifier: nodeVerifier,
    fetchImpl: respond(pointer()).impl,
  });
  assert.equal(missing.ok, false);
  if (missing.ok) return;
  assert.equal(missing.problem, 'signature_missing');
  assert.equal(pointerProblemReason(missing.problem), 'unsigned_bundle');
});

test('a pointer signed for different content is rejected', async () => {
  const signedForAnother = signPointer(pointer({ notes: 'other' }));

  const result = await fetchChannelLatest({
    channel: CHANNEL,
    requireSignature: true,
    publicKeyBase64: PUBLIC_KEY_BASE64,
    verifier: nodeVerifier,
    fetchImpl: respond({ ...pointer(), signature: signedForAnother }).impl,
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.problem, 'signature_invalid');
  assert.equal(pointerProblemReason(result.problem), 'unsigned_bundle');
});

test('a truncated or non-base64 signature is rejected without calling the verifier', async () => {
  let verifierCalls = 0;
  const counting: Ed25519Verifier = async (payload, signature, key) => {
    verifierCalls += 1;
    return nodeVerifier(payload, signature, key);
  };

  for (const signature of ['not base64!', Buffer.alloc(32).toString('base64')]) {
    const result = await fetchChannelLatest({
      channel: CHANNEL,
      requireSignature: true,
      publicKeyBase64: PUBLIC_KEY_BASE64,
      verifier: counting,
      fetchImpl: respond({ ...pointer(), signature }).impl,
    });
    assert.equal(result.ok, false);
    if (result.ok) continue;
    assert.equal(result.problem, 'signature_invalid');
  }
  assert.equal(verifierCalls, 0);
});

test('an unsigned pointer is blocked when the build cannot verify anything', async () => {
  const noKey = await fetchChannelLatest({
    channel: CHANNEL,
    requireSignature: true,
    publicKeyBase64: '',
    verifier: nodeVerifier,
    fetchImpl: respond({ ...pointer(), signature: signPointer() }).impl,
  });
  assert.equal(noKey.ok, false);
  if (!noKey.ok) assert.equal(noKey.problem, 'signature_unsupported');

  const noVerifier = await fetchChannelLatest({
    channel: CHANNEL,
    requireSignature: true,
    publicKeyBase64: PUBLIC_KEY_BASE64,
    verifier: null,
    fetchImpl: respond({ ...pointer(), signature: signPointer() }).impl,
  });
  assert.equal(noVerifier.ok, false);
  if (!noVerifier.ok) {
    assert.equal(noVerifier.problem, 'signature_unsupported');
    assert.equal(pointerProblemReason(noVerifier.problem), 'unsigned_bundle');
  }
});

test('signatures verify with Web Crypto where Ed25519 is available', {
  skip: createWebCryptoEd25519Verifier() === null,
}, async () => {
  const webcrypto = createWebCryptoEd25519Verifier();
  assert.ok(webcrypto);

  const good = await webcrypto(
    new TextEncoder().encode(pointerPayload(pointer())),
    base64ToBytes(signPointer()) as Uint8Array,
    rawPublicKey
  );
  assert.equal(good, true);

  const tampered = await webcrypto(
    new TextEncoder().encode(pointerPayload(pointer({ notes: 'tampered' }))),
    base64ToBytes(signPointer()) as Uint8Array,
    rawPublicKey
  );
  assert.equal(tampered, false);
});

/* ----------------------------- transport --------------------------- */

test('an offline device returns without touching the network', async () => {
  const { impl, calls } = respond({ ...pointer(), signature: signPointer() });
  const result = await fetchChannelLatest({
    channel: CHANNEL,
    fetchImpl: impl,
    isOnline: () => false,
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.problem, 'offline');
  assert.equal(calls.length, 0);
  // Transport problems are retried with backoff, never treated as a block.
  assert.equal(pointerProblemReason('offline'), null);
});

test('an HTTP error is a retryable failure', async () => {
  const result = await fetchChannelLatest({
    channel: CHANNEL,
    fetchImpl: respond('nope', { ok: false, status: 404 }).impl,
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.problem, 'http_error');
  assert.equal(pointerProblemReason(result.problem), null);
});

test('a missing Production channel pointer is never treated as a published release', async () => {
  const result = await fetchChannelLatest({
    channel: 'production-android',
    requireSignature: true,
    publicKeyBase64: PUBLIC_KEY_BASE64,
    verifier: nodeVerifier,
    fetchImpl: respond('not found', { ok: false, status: 404 }).impl,
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.problem, 'http_error');
  assert.equal(pointerProblemReason(result.problem), null);
});

test('non-JSON, oversized and unreachable responses never throw', async () => {
  const nonJson = await fetchChannelLatest({
    channel: CHANNEL,
    fetchImpl: respond('<html>404</html>').impl,
  });
  assert.equal(nonJson.ok, false);
  if (!nonJson.ok) assert.equal(nonJson.problem, 'invalid_pointer');

  const oversized = await fetchChannelLatest({
    channel: CHANNEL,
    fetchImpl: respond({ ...pointer(), pad: 'x'.repeat(9_000) }).impl,
  });
  assert.equal(oversized.ok, false);
  if (!oversized.ok) assert.equal(oversized.problem, 'invalid_pointer');

  const exploding = await fetchChannelLatest({
    channel: CHANNEL,
    fetchImpl: async () => {
      throw new Error('dns failure');
    },
  });
  assert.equal(exploding.ok, false);
  if (!exploding.ok) assert.equal(exploding.problem, 'network_error');
});

test('a non-https manifest base url is refused before any request', async () => {
  const { impl, calls } = respond({ ...pointer(), signature: signPointer() });
  const result = await fetchChannelLatest({
    channel: CHANNEL,
    baseUrl: 'http://raw.githubusercontent.com/towkirahmedrony/porokh-ota/main/channels',
    fetchImpl: impl,
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.problem, 'unsafe_url');
  assert.equal(calls.length, 0);
});

test('an invalid channel name never becomes a request path', async () => {
  const { impl, calls } = respond({});
  const result = await fetchChannelLatest({
    channel: '../production-android',
    fetchImpl: impl,
  });
  assert.equal(result.ok, false);
  assert.equal(calls.length, 0);
});
