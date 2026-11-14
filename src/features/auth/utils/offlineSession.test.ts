import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OFFLINE_SESSION_GRACE_MS,
  isSessionBeyondOfflineGrace,
  isSessionExpiredWithinGrace,
} from './offlineSession';

const NOW = Date.parse('2026-11-14T12:00:00.000Z');
const seconds = (ms: number) => ms / 1000;

test('a session that expired an hour ago is still usable offline', () => {
  const session = { expires_at: seconds(NOW - 60 * 60 * 1000) };

  assert.equal(isSessionBeyondOfflineGrace(session, NOW), false);
  assert.equal(isSessionExpiredWithinGrace(session, NOW), true);
});

test('a session is discarded only after the offline grace window', () => {
  const justInside = {
    expires_at: seconds(NOW - OFFLINE_SESSION_GRACE_MS + 60_000),
  };
  const justOutside = {
    expires_at: seconds(NOW - OFFLINE_SESSION_GRACE_MS - 60_000),
  };

  assert.equal(isSessionBeyondOfflineGrace(justInside, NOW), false);
  assert.equal(isSessionBeyondOfflineGrace(justOutside, NOW), true);
});

test('a valid session is never treated as expired', () => {
  const session = { expires_at: seconds(NOW + 30 * 60 * 1000) };

  assert.equal(isSessionBeyondOfflineGrace(session, NOW), false);
  assert.equal(isSessionExpiredWithinGrace(session, NOW), false);
});

test('an unknown expiry is left to the normal SDK refresh path', () => {
  assert.equal(isSessionBeyondOfflineGrace(null, NOW), false);
  assert.equal(isSessionBeyondOfflineGrace({}, NOW), false);
  assert.equal(
    isSessionBeyondOfflineGrace({ expires_at: undefined } as never, NOW),
    false
  );
});
