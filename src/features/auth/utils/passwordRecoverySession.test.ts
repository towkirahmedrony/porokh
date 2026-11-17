import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RECOVERY_MARKER_FRESHNESS_MS,
  clearPasswordRecoverySession,
  hasPasswordRecoverySession,
  hasRecentPasswordRecoverySession,
  rememberPasswordRecoverySession,
} from './passwordRecoverySession';

const installStorage = () => {
  const values = new Map<string, string>();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      sessionStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    },
  });
  return () => {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  };
};

const makeSession = (userId: string, sessionId: string, expiresAt = Math.floor(Date.now() / 1000) + 300) => {
  const payload = Buffer.from(JSON.stringify({ session_id: sessionId })).toString('base64url');
  return {
    user: { id: userId },
    access_token: `header.${payload}.signature`,
    expires_at: expiresAt,
  } as any;
};

test('recovery marker is bound to the validated user and Supabase session id', () => {
  const restore = installStorage();
  try {
    const session = makeSession('user-1', 'session-1');
    rememberPasswordRecoverySession(session);
    assert.equal(hasPasswordRecoverySession(session), true);
    assert.equal(hasPasswordRecoverySession(makeSession('user-2', 'session-1')), false);
    assert.equal(hasPasswordRecoverySession(makeSession('user-1', 'session-2')), false);
    clearPasswordRecoverySession();
    assert.equal(hasPasswordRecoverySession(session), false);
  } finally {
    restore();
  }
});

test('expired recovery markers are rejected', () => {
  const restore = installStorage();
  try {
    const session = makeSession('user-1', 'session-1', Math.floor(Date.now() / 1000) - 10);
    rememberPasswordRecoverySession(session);
    assert.equal(hasPasswordRecoverySession(session), false);
  } finally {
    restore();
  }
});

test('the redirect marker is only fresh right after the link was verified', () => {
  const restore = installStorage();
  try {
    const session = makeSession('user-1', 'session-1');
    rememberPasswordRecoverySession(session);

    assert.equal(hasRecentPasswordRecoverySession(session), true);

    // Simulate a marker created longer ago than the freshness window.
    const staleGrant = {
      userId: 'user-1',
      sessionId: 'session-1',
      expiresAt: session.expires_at * 1000,
      createdAt: Date.now() - RECOVERY_MARKER_FRESHNESS_MS - 1000,
    };
    window.sessionStorage.setItem(
      'parapoth:password-recovery-session',
      JSON.stringify(staleGrant)
    );

    assert.equal(hasPasswordRecoverySession(session), true);
    assert.equal(hasRecentPasswordRecoverySession(session), false);
  } finally {
    restore();
  }
});

test('markers written before the freshness field existed are not treated as fresh', () => {
  const restore = installStorage();
  try {
    const session = makeSession('user-1', 'session-1');
    window.sessionStorage.setItem(
      'parapoth:password-recovery-session',
      JSON.stringify({
        userId: 'user-1',
        sessionId: 'session-1',
        expiresAt: session.expires_at * 1000,
      })
    );

    assert.equal(hasPasswordRecoverySession(session), true);
    assert.equal(hasRecentPasswordRecoverySession(session), false);
  } finally {
    restore();
  }
});
