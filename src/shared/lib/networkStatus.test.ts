import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getNetworkStatus,
  reportNetworkFailure,
  reportNetworkSuccess,
  subscribeNetworkStatus,
} from './networkStatus';

test('a failed request marks the app offline', () => {
  reportNetworkSuccess();
  reportNetworkFailure();

  assert.equal(getNetworkStatus(), 'offline');
});

test('a completed request restores the online state', () => {
  reportNetworkFailure();
  reportNetworkSuccess();

  assert.equal(getNetworkStatus(), 'online');
});

test('subscribers hear about changes exactly once', () => {
  reportNetworkSuccess();

  let calls = 0;
  const unsubscribe = subscribeNetworkStatus(() => {
    calls += 1;
  });

  reportNetworkFailure();
  reportNetworkFailure(); // same state, no extra notification
  reportNetworkSuccess();

  unsubscribe();
  reportNetworkFailure();

  assert.equal(calls, 2);
  assert.equal(getNetworkStatus(), 'offline');

  // Leave the module in its default state for the other tests in this file.
  reportNetworkSuccess();
});
