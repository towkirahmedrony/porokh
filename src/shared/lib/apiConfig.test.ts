import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  API_PATH,
  API_URL_ENV_VAR,
  buildApiUrl,
  normalizeApiBaseUrl,
  resolveApiBaseUrl,
} from './apiConfig';

const HOST = 'https://api.example.test';

test('the env key and API prefix are the agreed contract', () => {
  assert.equal(API_URL_ENV_VAR, 'VITE_API_URL');
  assert.equal(API_PATH, '/api/v1');
});

test('a missing environment variable fails loudly instead of using a fallback', () => {
  // The test process has no Vite env, so reading the variable must throw.
  assert.throws(() => resolveApiBaseUrl(), new RegExp(API_URL_ENV_VAR));
  assert.throws(() => resolveApiBaseUrl('   '), new RegExp(API_URL_ENV_VAR));
  assert.throws(() => normalizeApiBaseUrl(undefined), new RegExp(API_URL_ENV_VAR));
  assert.throws(() => normalizeApiBaseUrl(null), new RegExp(API_URL_ENV_VAR));
});

test('only an absolute http(s) URL is accepted', () => {
  assert.throws(() => normalizeApiBaseUrl('api.example.test/api/v1'), /absolute http\(s\)/);
  assert.throws(() => normalizeApiBaseUrl('ftp://api.example.test'), /absolute http\(s\)/);
});

test('trailing slashes and a missing /api/v1 prefix are normalised', () => {
  assert.equal(normalizeApiBaseUrl('  https://api.example.test///  '), `${HOST}/api/v1`);
  assert.equal(normalizeApiBaseUrl(`${HOST}/api/v1`), `${HOST}/api/v1`);
  assert.equal(normalizeApiBaseUrl(`${HOST}/api/v1/`), `${HOST}/api/v1`);
});

test('an explicit value wins over the environment', () => {
  assert.equal(resolveApiBaseUrl(HOST), `${HOST}/api/v1`);
});

test('buildApiUrl joins exactly one slash and never doubles /api/v1', () => {
  assert.equal(buildApiUrl('/auth/logout', HOST), `${HOST}/api/v1/auth/logout`);
  assert.equal(buildApiUrl('auth/logout', `${HOST}/api/v1`), `${HOST}/api/v1/auth/logout`);
  assert.equal(
    buildApiUrl('/auth/save-device', `${HOST}/api/v1`).includes('/api/v1/api/'),
    false
  );
});

test('no backend host is baked into the configuration module', () => {
  const source = readFileSync(new URL('./apiConfig.ts', import.meta.url), 'utf8');
  assert.equal(/onrender\.com/i.test(source), false);
  assert.equal(/parapoth/i.test(source), false);
});
