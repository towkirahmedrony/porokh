import test from 'node:test';
import assert from 'node:assert/strict';

import {
  toNativePushStatus,
  canRequestNativePermission,
  shouldLinkPushToUser,
  shouldAskOnFirstLaunch,
  isNativePushRegistered,
  buildPushDiagnostics,
  formatPushDiagnostics,
} from './pushPermission.ts';

test('Firebase Messaging permission answers map to the four UI states', () => {
  assert.equal(toNativePushStatus({ receive: 'granted' }), 'granted');
  // Android 13+ before the dialog has been shown.
  assert.equal(toNativePushStatus({ receive: 'prompt' }), 'prompt');
  assert.equal(toNativePushStatus({ receive: 'prompt-with-rationale' }), 'prompt');
  // Denied once: Android will not show the dialog again.
  assert.equal(toNativePushStatus({ receive: 'denied' }), 'denied');
  assert.equal(toNativePushStatus({}), 'unsupported');
  assert.equal(toNativePushStatus({ receive: 'yes' }), 'unsupported');
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

test('the first-launch prompt runs once and never overrides a user choice', () => {
  assert.equal(shouldAskOnFirstLaunch('prompt', false, false), true);
  // Already answered on an earlier launch.
  assert.equal(shouldAskOnFirstLaunch('prompt', true, false), false);
  // Turned off on this device; a fresh dialog would undo that decision.
  assert.equal(shouldAskOnFirstLaunch('prompt', false, true), false);
  assert.equal(shouldAskOnFirstLaunch('granted', false, false), false);
  assert.equal(shouldAskOnFirstLaunch('denied', false, false), false);
});

test('permission alone does not count as a registered device', () => {
  assert.equal(isNativePushRegistered({ token: 'fcm-token' }), true);
  // Token has not arrived yet: the backend has no address for this device.
  assert.equal(isNativePushRegistered({ token: null }), false);
  assert.equal(isNativePushRegistered({ token: '   ' }), false);
  assert.equal(isNativePushRegistered(null), false);
});

test('diagnostics report state without leaking the FCM token', () => {
  const token = 'fcm-secret-value-that-must-not-be-logged';
  const diagnostics = buildPushDiagnostics({
    initState: 'initialized',
    hasToken: true,
    permissionGranted: true,
  });

  assert.deepEqual(diagnostics, {
    initState: 'initialized',
    initialized: true,
    hasToken: true,
    permissionGranted: true,
  });

  const line = formatPushDiagnostics(diagnostics);
  assert.ok(line.startsWith('[fcm:diag] '));
  assert.equal(line.includes(token), false);

  // A build without the plugin is distinguishable from a failed initialisation.
  assert.equal(
    buildPushDiagnostics({
      initState: 'plugin_unavailable',
      hasToken: false,
      permissionGranted: false,
    }).initialized,
    false
  );
});
