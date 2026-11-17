import assert from 'node:assert/strict';
import test from 'node:test';
import {
  API_BASE_URL,
  PRODUCTION_API_BASE_URL,
  buildApiUrl,
  normalizeApiBaseUrl,
  resolveApiBaseUrl,
} from './apiConfig';

test('the production API base URL is the parapoth Render service', () => {
  assert.equal(PRODUCTION_API_BASE_URL, 'https://parapoth-backend.onrender.com/api/v1');
  assert.equal(API_BASE_URL, PRODUCTION_API_BASE_URL);
  assert.equal(resolveApiBaseUrl(), PRODUCTION_API_BASE_URL);
});

test('the production API base URL never points at porokh-backend', () => {
  assert.equal(PRODUCTION_API_BASE_URL.includes('porokh-backend.onrender.com'), false);
  assert.equal(PRODUCTION_API_BASE_URL.endsWith('/api/v1'), true);
});

test('normalizeApiBaseUrl trims whitespace and trailing slashes', () => {
  assert.equal(normalizeApiBaseUrl('  https://example.com/api/v1///  '), 'https://example.com/api/v1');
  assert.equal(normalizeApiBaseUrl(''), PRODUCTION_API_BASE_URL);
  assert.equal(normalizeApiBaseUrl('   '), PRODUCTION_API_BASE_URL);
  assert.equal(normalizeApiBaseUrl(undefined), PRODUCTION_API_BASE_URL);
  assert.equal(normalizeApiBaseUrl(null), PRODUCTION_API_BASE_URL);
});

test('buildApiUrl joins exactly one slash between base and path', () => {
  assert.equal(buildApiUrl('/auth/logout'), `${PRODUCTION_API_BASE_URL}/auth/logout`);
  assert.equal(buildApiUrl('auth/logout'), `${PRODUCTION_API_BASE_URL}/auth/logout`);
  assert.equal(buildApiUrl('/auth/save-device').includes('/api/v1/api/'), false);
});
