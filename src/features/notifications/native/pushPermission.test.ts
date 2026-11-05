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
  const registered = {
    subscriptionId: 'sub-1',
    hasPushToken: true,
    optedIn: true,
  };

  assert.equal(isNativePushRegistered(registered), true);
  // Token has not arrived yet: OneSignal cannot deliver to this subscription.
  assert.equal(isNativePushRegistered({ ...registered, hasPushToken: false }), false);
  assert.equal(isNativePushRegistered({ ...registered, subscriptionId: null }), false);
  assert.equal(isNativePushRegistered({ ...registered, optedIn: false }), false);
  assert.equal(isNativePushRegistered(null), false);
});

test('diagnostics report state without leaking the subscription or push token', () => {
  const user = '11111111-1111-4111-8111-111111111111';
  const diagnostics = buildPushDiagnostics({
    initState: 'initialized',
    externalId: user,
    userId: user,
    subscriptionId: 'sub-secret-value',
    hasPushToken: true,
    optedIn: true,
    permissionGranted: true,
  });

  assert.deepEqual(diagnostics, {
    initState: 'initialized',
    initialized: true,
    externalIdMatchesUser: true,
    subscriptionIdAvailable: true,
    hasPushToken: true,
    optedIn: true,
    permissionGranted: true,
  });

  const line = formatPushDiagnostics(diagnostics);
  assert.ok(line.startsWith('[onesignal:diag] '));
  assert.equal(line.includes('sub-secret-value'), false);
  assert.equal(line.includes(user), false);

  // A device logged in as another account must not report a match.
  assert.equal(
    buildPushDiagnostics({
      initState: 'initialized',
      externalId: 'someone-else',
      userId: user,
      subscriptionId: null,
      hasPushToken: false,
      optedIn: false,
      permissionGranted: false,
    }).externalIdMatchesUser,
    false
  );

  // A build without an app id is distinguishable from a failed initialisation.
  assert.equal(
    buildPushDiagnostics({
      initState: 'missing_app_id',
      externalId: null,
      userId: null,
      subscriptionId: null,
      hasPushToken: false,
      optedIn: false,
      permissionGranted: false,
    }).initialized,
    false
  );
});
