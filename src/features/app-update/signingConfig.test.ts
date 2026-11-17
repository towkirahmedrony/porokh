import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isValidCapgoPrivateKey,
  isValidCapgoPublicKey,
  normalizePem,
  resolveSignaturePolicy,
} from './signingConfig.ts';

/**
 * A structurally valid PKCS#1 RSA public key (2048-bit, 294-byte body).
 * Generated for these tests only; it protects nothing.
 */
const BODY = 'A'.repeat(392);
const PUBLIC_KEY = `-----BEGIN RSA PUBLIC KEY-----\n${BODY}\n-----END RSA PUBLIC KEY-----`;
const PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----\n${'B'.repeat(1624)}\n-----END RSA PRIVATE KEY-----`;

test('a PKCS#1 RSA public key is accepted', () => {
  assert.equal(isValidCapgoPublicKey(PUBLIC_KEY), true);
});

test('an SPKI key (-----BEGIN PUBLIC KEY-----) is rejected', () => {
  // The native parser strips only the PKCS#1 header, so an SPKI key would load
  // and then fail at verification time on the device.
  const spki = `-----BEGIN PUBLIC KEY-----\n${BODY}\n-----END PUBLIC KEY-----`;
  assert.equal(isValidCapgoPublicKey(spki), false);
});

test('escaped newlines from CI secrets are normalised', () => {
  const escaped = PUBLIC_KEY.replace(/\n/g, '\\n');
  assert.equal(normalizePem(escaped).includes('\n'), true);
  assert.equal(isValidCapgoPublicKey(escaped), true);
});

test('truncated, empty and non-base64 keys are rejected', () => {
  assert.equal(isValidCapgoPublicKey(''), false);
  assert.equal(isValidCapgoPublicKey(undefined), false);
  assert.equal(isValidCapgoPublicKey('-----BEGIN RSA PUBLIC KEY-----'), false);
  assert.equal(
    isValidCapgoPublicKey(
      '-----BEGIN RSA PUBLIC KEY-----\nnot base64 !!!\n-----END RSA PUBLIC KEY-----'
    ),
    false
  );
  assert.equal(
    isValidCapgoPublicKey(
      `-----BEGIN RSA PUBLIC KEY-----\n${'A'.repeat(100)}\n-----END RSA PUBLIC KEY-----`
    ),
    false,
    'too short to be an RSA public key'
  );
});

test('a PEM private key is accepted and garbage is not', () => {
  assert.equal(isValidCapgoPrivateKey(PRIVATE_KEY), true);
  assert.equal(isValidCapgoPrivateKey(''), false);
  assert.equal(isValidCapgoPrivateKey('secret'), false);
  assert.equal(
    isValidCapgoPrivateKey('-----BEGIN RSA PRIVATE KEY-----\nshort\n-----END RSA PRIVATE KEY-----'),
    false
  );
});

test('requiring signatures without a key fails the build', () => {
  const missing = resolveSignaturePolicy({ requireSignature: true });
  assert.equal(missing.ok, false);
  assert.equal(missing.ok === false && missing.problem, 'missing_public_key');

  const malformed = resolveSignaturePolicy({
    requireSignature: true,
    publicKey: '-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----',
  });
  assert.equal(malformed.ok, false);
  assert.equal(malformed.ok === false && malformed.problem, 'invalid_public_key');
});

test('requiring signatures with a valid key enables enforcement', () => {
  const result = resolveSignaturePolicy({
    requireSignature: true,
    publicKey: PUBLIC_KEY,
  });

  assert.equal(result.ok, true);
  assert.equal(result.ok === true && result.policy.required, true);
  assert.equal(result.ok === true && result.policy.publicKey, PUBLIC_KEY);
});

test('a local build without the requirement stays usable but silent', () => {
  const withoutKey = resolveSignaturePolicy({ requireSignature: false });
  assert.equal(withoutKey.ok, true);
  assert.equal(withoutKey.ok === true && withoutKey.policy.required, false);
  assert.equal(withoutKey.ok === true && withoutKey.policy.publicKey, null);

  const withKey = resolveSignaturePolicy({
    requireSignature: false,
    publicKey: PUBLIC_KEY,
  });
  assert.equal(withKey.ok === true && withKey.policy.publicKey, PUBLIC_KEY);
});
