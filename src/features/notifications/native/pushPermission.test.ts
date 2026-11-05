import test from 'node:test';
import assert from 'node:assert/strict';

import {
  toNativePushStatus,
  canRequestNativePermission,
  shouldLinkPushToUser,
} from './pushPermission.ts';

test('OneSignal permission answers map to the four UI states', () => {
  assert.equal(toNativePushStatus({ granted: true, canAsk: false }), 'granted');
  // Android 13+ before the dialog has been shown.
  assert.equal(toNativePushStatus({ granted: false, canAsk: true }), 'prompt');
  // Denied once: Android will not show the dialog again.
  assert.equal(toNativePushStatus({ granted: false, canAsk: false }), 'denied');
  assert.equal(toNativePushStatus({}), 'unsupported');
  assert.equal(toNativePushStatus({ granted: 'yes' }), 'unsupported');
});

test('a denied user is never asked again', () => {
  assert.equal(canRequestNativePermission('denied'), false);
  assert.equal(canRequestNativePermission('prompt'), true);
  assert.equal(canRequestNativePermission('granted'), false);
});

test('a device is only linked to a user when permission and a session both exist', () => {
  assert.equal(shouldLinkPushToUser('granted', 'user-1'), true);
  assert.equal(shouldLinkPushToUser('granted', null), false);
  assert.equal(shouldLinkPushToUser('denied', 'user-1'), false);
});
