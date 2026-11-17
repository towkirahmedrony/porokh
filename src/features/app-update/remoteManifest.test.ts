import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PRODUCTION_WEB_URL,
  compareBuilds,
  fetchRemoteManifest,
  isAllowedManifestUrl,
  manifestUrl,
  parseRemoteManifest,
} from './remoteManifest.ts';

const MANIFEST = {
  version: '1.0.1',
  buildId: 'abc123-2026-10-27T00:00:00.000Z',
  channel: 'production-android',
  builtAt: '2026-10-27T00:00:00.000Z',
  minNativeVersion: null,
  apkUrl: null,
};

const respond = (body: unknown, init: { ok?: boolean; status?: number } = {}) => {
  const calls: Array<{ url: string; init?: Record<string, unknown> }> = [];
  const impl = async (url: string, options?: Record<string, unknown>) => {
    calls.push({ url, init: options });
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return {
      ok: init.ok ?? true,
      status: init.status ?? 200,
      text: async () => text,
    };
  };
  return { impl, calls };
};

test('the manifest lives next to index.html on the production deployment', () => {
  assert.equal(manifestUrl(), `${PRODUCTION_WEB_URL}/version.json`);
  assert.equal(manifestUrl('https://example.com/'), 'https://example.com/version.json');
});

test('only https (or local dev) manifest URLs are accepted', () => {
  assert.equal(isAllowedManifestUrl('https://porokhbd.vercel.app/version.json'), true);
  assert.equal(isAllowedManifestUrl('http://localhost:5173/version.json'), true);
  assert.equal(isAllowedManifestUrl('http://porokhbd.vercel.app/version.json'), false);
  assert.equal(isAllowedManifestUrl('javascript:alert(1)'), false);
  assert.equal(isAllowedManifestUrl('not a url'), false);
});

test('a complete manifest is accepted', () => {
  const manifest = parseRemoteManifest({ ...MANIFEST, apkUrl: 'https://cdn.example.com/porokh.apk' });

  assert.equal(manifest?.version, '1.0.1');
  assert.equal(manifest?.apkUrl, 'https://cdn.example.com/porokh.apk');
  assert.equal(manifest?.minNativeVersion, null);
});

test('malformed manifests are rejected instead of being trusted', () => {
  const bad = [
    null,
    [],
    'string',
    {},
    { ...MANIFEST, version: '1.0' },
    { ...MANIFEST, version: 'v1.0.0' },
    { ...MANIFEST, buildId: '' },
    { ...MANIFEST, buildId: 'x'.repeat(200) },
  ];

  for (const value of bad) {
    assert.equal(parseRemoteManifest(value), null, JSON.stringify(value));
  }
});

test('a non-https apkUrl is dropped', () => {
  const manifest = parseRemoteManifest({ ...MANIFEST, apkUrl: 'http://insecure/porokh.apk' });
  assert.equal(manifest?.apkUrl, null);
});

test('fetchRemoteManifest never uses the HTTP cache', async () => {
  const { impl, calls } = respond(MANIFEST);

  const result = await fetchRemoteManifest({
    fetchImpl: impl,
    isOnline: () => true,
    now: () => 123,
  });

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init?.cache, 'no-store');
  assert.equal(calls[0].init?.credentials, 'omit');
  assert.match(calls[0].url, /\?t=123$/);
});

test('offline short-circuits before any request', async () => {
  const { impl, calls } = respond(MANIFEST);

  const result = await fetchRemoteManifest({ fetchImpl: impl, isOnline: () => false });

  assert.deepEqual(result, { ok: false, reason: 'offline' });
  assert.equal(calls.length, 0);
});

test('an HTTP error is reported, not mistaken for an update', async () => {
  const { impl } = respond('nope', { ok: false, status: 503 });

  const result = await fetchRemoteManifest({ fetchImpl: impl, isOnline: () => true });

  assert.deepEqual(result, { ok: false, reason: 'http_error', detail: 'HTTP 503' });
});

test('the SPA fallback HTML is rejected as an invalid manifest', async () => {
  const { impl } = respond('<!doctype html><html></html>');

  const result = await fetchRemoteManifest({ fetchImpl: impl, isOnline: () => true });

  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, 'invalid_manifest');
});

test('an oversized response is rejected', async () => {
  const { impl } = respond(JSON.stringify({ ...MANIFEST, padding: 'x'.repeat(9000) }));

  const result = await fetchRemoteManifest({ fetchImpl: impl, isOnline: () => true });

  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.detail, 'oversized');
});

test('a timeout is reported as a network error', async () => {
  const impl = async () => {
    const error = new Error('aborted');
    error.name = 'AbortError';
    throw error;
  };

  const result = await fetchRemoteManifest({ fetchImpl: impl, isOnline: () => true });

  assert.deepEqual(result, { ok: false, reason: 'network_error', detail: 'timeout' });
});

test('compareBuilds treats a new build id on the same version as an update', () => {
  const local = { version: '1.0.0', buildId: 'old' };

  assert.equal(compareBuilds(local, { ...MANIFEST, version: '1.0.1' }).status, 'update_available');
  assert.equal(compareBuilds(local, { ...MANIFEST, version: '1.0.0' }).status, 'update_available');
  assert.equal(compareBuilds(local, { ...MANIFEST, version: '0.9.0' }).status, 'local_ahead');
  assert.equal(
    compareBuilds({ version: '1.0.0', buildId: MANIFEST.buildId }, { ...MANIFEST, version: '1.0.0' })
      .status,
    'up_to_date'
  );
});
