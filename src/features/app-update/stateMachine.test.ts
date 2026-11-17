import test from 'node:test';
import assert from 'node:assert/strict';

import { assertOtaTransition, canTransitionOta } from './stateMachine.ts';

test('bundle must be staged before activation', () => {
  assert.equal(canTransitionOta('downloading', 'staged'), true);
  assert.equal(canTransitionOta('staged', 'activating'), true);
  assert.equal(canTransitionOta('activation_blocked', 'activating'), true);
  assert.equal(canTransitionOta('downloading', 'activating'), false);
  assert.equal(canTransitionOta('available', 'activating'), false);
  assert.equal(canTransitionOta('activation_failed', 'activating'), false);
});

test('a failed download can never be reported as activated', () => {
  assert.equal(canTransitionOta('downloading', 'activated'), false);
  assert.equal(canTransitionOta('download_failed', 'activated'), false);
  assert.equal(canTransitionOta('rejected', 'activated'), false);
});

test('an activated update is only reachable from activating or a boot restore', () => {
  assert.equal(canTransitionOta('activating', 'activated'), true);
  assert.equal(canTransitionOta('idle', 'activated'), true);
  assert.equal(canTransitionOta('staged', 'activated'), true);
});

test('assert throws for an impossible transition', () => {
  assert.throws(
    () => assertOtaTransition('checking', 'activating'),
    /Invalid OTA phase transition/
  );
  assert.doesNotThrow(() => assertOtaTransition('checking', 'available'));
});
