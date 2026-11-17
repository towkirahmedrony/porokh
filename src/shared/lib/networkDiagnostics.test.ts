import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildNetworkDiagnostic,
  formatNetworkDiagnostic,
  sanitizeApiUrl,
} from './networkDiagnostics';

test('sanitizeApiUrl keeps only origin and path', () => {
  const sanitized = sanitizeApiUrl(
    'https://user:pass@parapoth-backend.onrender.com/api/v1/profiles/me?access_token=secret#fragment'
  );
  assert.equal(sanitized.origin, 'https://parapoth-backend.onrender.com');
  assert.equal(sanitized.path, '/api/v1/profiles/me');
  assert.deepEqual(Object.keys(sanitized).sort(), ['origin', 'path']);
});

test('diagnostics never contain tokens, credentials, query strings or headers', () => {
  const diagnostic = buildNetworkDiagnostic({
    url: 'https://parapoth-backend.onrender.com/api/v1/growth/stats?token=top-secret&api_key=also-secret',
    method: 'post',
    status: 401,
    code: 'UNAUTHORIZED',
    durationMs: 42.6,
  });

  const serialized = JSON.stringify(diagnostic);
  assert.equal(serialized.includes('top-secret'), false);
  assert.equal(serialized.includes('also-secret'), false);
  assert.equal(serialized.includes('secret'), false);
  assert.equal(serialized.includes('token'), false);
  assert.equal(serialized.includes('Authorization'), false);
  assert.equal(diagnostic.method, 'POST');
  assert.equal(diagnostic.origin, 'https://parapoth-backend.onrender.com');
  assert.equal(diagnostic.path, '/api/v1/growth/stats');
  assert.equal(diagnostic.status, 401);
  assert.equal(diagnostic.code, 'UNAUTHORIZED');
  assert.equal(diagnostic.durationMs, 43);
});

test('relative API URLs resolve against the configured production base', () => {
  const sanitized = sanitizeApiUrl('/api/v1/contact');
  assert.equal(sanitized.path, '/api/v1/contact');
  assert.equal(sanitized.origin, 'https://parapoth-backend.onrender.com');
});

test('negative durations are clamped and missing fields are omitted', () => {
  const diagnostic = buildNetworkDiagnostic({ durationMs: -15 });
  assert.equal(diagnostic.durationMs, 0);
  assert.equal(diagnostic.status, undefined);
  assert.equal('status' in diagnostic, false);
});

test('formatNetworkDiagnostic is a single credential-safe line', () => {
  const line = formatNetworkDiagnostic({
    url: 'https://parapoth-backend.onrender.com/api/v1/x?token=secret',
    method: 'get',
    status: 403,
    durationMs: 10.4,
  });
  assert.equal(line, 'GET https://parapoth-backend.onrender.com/api/v1/x status=403 duration=10ms');
  assert.equal(line.includes('secret'), false);
});
