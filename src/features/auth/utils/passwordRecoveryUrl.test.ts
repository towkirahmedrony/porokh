import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getRecoveryErrorKind,
  normalizeRecoveryReason,
  readPasswordRecoveryErrorFromUrl,
} from './passwordRecovery';

test('an expired implicit recovery link is recognized from the URL fragment', () => {
  const kind = readPasswordRecoveryErrorFromUrl({
    search: '',
    hash: '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
  });

  assert.equal(kind, 'expired');
});

test('a PKCE style error is recognized from the query string', () => {
  const kind = getRecoveryErrorKind(
    new URLSearchParams('error=access_denied&error_code=otp_expired'),
    new URLSearchParams('')
  );

  assert.equal(kind, 'expired');
});

test('other provider errors are reported as an invalid link, not as no error', () => {
  assert.equal(
    getRecoveryErrorKind(
      new URLSearchParams('error=access_denied&error_description=Invalid+request'),
      new URLSearchParams('')
    ),
    'invalid'
  );
});

test('a clean URL has no recovery error', () => {
  assert.equal(
    readPasswordRecoveryErrorFromUrl({ search: '?mode=recovery', hash: '' }),
    null
  );
});

test('only known reason values are accepted from the redirect', () => {
  assert.equal(normalizeRecoveryReason('expired'), 'expired');
  assert.equal(normalizeRecoveryReason('invalid'), 'invalid');
  assert.equal(normalizeRecoveryReason('anything-else'), null);
  assert.equal(normalizeRecoveryReason(null), null);
});
