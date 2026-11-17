import test from 'node:test';
import assert from 'node:assert/strict';

import { decideNativeStart } from './nativeStart.ts';

test('the website and PWA keep the public marketing homepage at "/"', () => {
  assert.equal(
    decideNativeStart({ native: false, authLoading: true, userId: null }),
    'landing'
  );
  assert.equal(
    decideNativeStart({ native: false, authLoading: false, userId: null }),
    'landing'
  );
  // A signed-in web visitor still owns "/" as the marketing homepage.
  assert.equal(
    decideNativeStart({ native: false, authLoading: false, userId: 'u1' }),
    'landing'
  );
});

test('the Android app lands on the dashboard once the session is restored', () => {
  assert.equal(
    decideNativeStart({ native: true, authLoading: false, userId: 'u1' }),
    'dashboard'
  );
});

test('the Android app lands on login without a session', () => {
  assert.equal(
    decideNativeStart({ native: true, authLoading: false, userId: null }),
    'login'
  );
});

test('a session still being restored never shows the landing page or login', () => {
  assert.equal(
    decideNativeStart({ native: true, authLoading: true, userId: null }),
    'loading'
  );
  // A persisted session can already be visible while the profile row loads;
  // the app still waits instead of committing to a screen early.
  assert.equal(
    decideNativeStart({ native: true, authLoading: true, userId: 'u1' }),
    'loading'
  );
});
