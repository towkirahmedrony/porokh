import test from 'node:test';
import assert from 'node:assert/strict';

import { toNativePushStatus, canRequestNativePermission, shouldRegisterNativePush } from './pushPermission.ts';

test('Google Play permission states map to the four UI states', () => {
  assert.equal(toNativePushStatus('granted'), 'granted');
  assert.equal(toNativePushStatus('denied'), 'denied');
  assert.equal(toNativePushStatus('prompt'), 'prompt');
  assert.equal(toNativePushStatus('prompt-with-rationale'), 'prompt');
  assert.equal(toNativePushStatus(undefined), 'unsupported');
  assert.equal(toNativePushStatus('something-else'), 'unsupported');
});

test('a denied user is never asked again', () => {
  assert.equal(canRequestNativePermission('denied'), false);
  assert.equal(canRequestNativePermission('prompt'), true);
  assert.equal(canRequestNativePermission('granted'), false);
});

test('the token is only registered when permission and a session both exist', () => {
  assert.equal(shouldRegisterNativePush('granted', 'user-1'), true);
  assert.equal(shouldRegisterNativePush('granted', null), false);
  assert.equal(shouldRegisterNativePush('denied', 'user-1'), false);
});
