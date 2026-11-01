import test from 'node:test';
import assert from 'node:assert/strict';

import {
  diagnosticErrorDetails,
  sanitizeDiagnosticDetails,
  sanitizeDiagnosticText,
} from './diagnostics.ts';

test('diagnostic text redacts bearer credentials and signed URL query strings', () => {
  const value = sanitizeDiagnosticText(
    'GET https://github.com/org/repo/file.zip?token=secret-value failed: Bearer abc.def.ghi'
  );

  assert.match(value, /https:\/\/github\.com\/org\/repo\/file\.zip\?\[query redacted\]/);
  assert.match(value, /Bearer \[redacted\]/);
  assert.doesNotMatch(value, /secret-value|abc\.def\.ghi/);
});

test('diagnostic text removes PEM private keys and long key-like values', () => {
  const value = sanitizeDiagnosticText(
    'bad key -----BEGIN PRIVATE KEY-----\nprivate-material\n-----END PRIVATE KEY----- token=' +
      'A'.repeat(120)
  );

  assert.match(value, /\[private key redacted\]/);
  assert.match(value, /token=\[redacted\]/);
  assert.doesNotMatch(value, /private-material|A{96}/);
});

test('diagnostic details redact sensitive field names but keep useful version data', () => {
  const value = sanitizeDiagnosticDetails({
    version: '1.0.2-ota.r000120',
    sessionKey: 'iv:secret',
    accessToken: 'abc123',
    hasChecksum: true,
    checksum: 'not-for-logs',
    percent: 42,
  });

  assert.equal(value.version, '1.0.2-ota.r000120');
  assert.equal(value.sessionKey, '[redacted]');
  assert.equal(value.accessToken, '[redacted]');
  assert.equal(value.hasChecksum, true);
  assert.equal(value.checksum, '[redacted]');
  assert.equal(value.percent, 42);
});

test('native error diagnostics keep error code and redact URL credentials', () => {
  const value = diagnosticErrorDetails({
    name: 'PluginError',
    code: 'DOWNLOAD_FAILED',
    status: 503,
    message: 'GET https://example.test/bundle.zip?access_token=private failed',
  });

  assert.equal(value.errorName, 'PluginError');
  assert.equal(value.errorCode, 'DOWNLOAD_FAILED');
  assert.equal(value.httpStatus, 503);
  assert.match(String(value.errorMessage), /\?\[query redacted\]/);
  assert.doesNotMatch(String(value.errorMessage), /private/);
});
