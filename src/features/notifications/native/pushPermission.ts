/**
 * Maps OneSignal's permission answers to the states the UI understands.
 *
 * OneSignal reports two booleans instead of a single status: whether push is
 * granted and whether asking would still show the system dialog. Android 12 and
 * below always report granted (no runtime permission exists), so `prompt` only
 * ever appears on 13+.
 */
export type NativePushStatus = 'unsupported' | 'prompt' | 'granted' | 'denied';

/**
 * Why the SDK is or is not running. Distinguishing "no app id" from "failed"
 * matters: a build that lost its VITE_ONESIGNAL_APP_ID looks exactly like a
 * working app until a push never arrives.
 */
export type OneSignalInitState =
  | 'sdk_unavailable'
  | 'missing_app_id'
  | 'pending'
  | 'initialized'
  | 'failed';

export const toNativePushStatus = (state: {
  granted?: unknown;
  canAsk?: unknown;
}): NativePushStatus => {
  if (state.granted === true) return 'granted';
  if (state.canAsk === true) return 'prompt';
  if (state.granted === false) return 'denied';
  return 'unsupported';
};

/**
 * Android only shows the runtime dialog while it still can. Once it records a
 * denial, the Settings screen is the only way back, so the card opens the
 * system screen instead of pretending the dialog will appear again.
 */
export const canRequestNativePermission = (status: NativePushStatus): boolean =>
  status === 'prompt';

/** Registering a device needs both permission and a signed-in user. */
export const shouldLinkPushToUser = (
  status: NativePushStatus,
  userId: string | null | undefined
): boolean => status === 'granted' && Boolean(userId);

/**
 * The one-time first-launch prompt. It is skipped when the user already
 * answered on a previous launch or deliberately turned notifications off, so
 * a reinstall is not required to make the dialog stop appearing.
 */
export const shouldAskOnFirstLaunch = (
  status: NativePushStatus,
  alreadyAsked: boolean,
  userDisabled: boolean
): boolean => status === 'prompt' && !alreadyAsked && !userDisabled;

/** What the SDK says about this installation right now. */
export interface PushSubscriptionSnapshot {
  subscriptionId: string | null;
  hasPushToken: boolean;
  optedIn: boolean;
}

/**
 * Granted permission is not the same as a registered device: the SDK still has
 * to assign a subscription id and receive the FCM token, and both can arrive
 * seconds after the permission dialog closes.
 */
export const isNativePushRegistered = (
  snapshot: PushSubscriptionSnapshot | null
): boolean =>
  Boolean(
    snapshot &&
      snapshot.optedIn &&
      snapshot.subscriptionId &&
      snapshot.hasPushToken
  );

export interface PushDiagnosticsInput extends PushSubscriptionSnapshot {
  initState: OneSignalInitState;
  externalId: string | null;
  userId: string | null;
  permissionGranted: boolean;
}

/**
 * Diagnostics describe state, never the state's contents: the subscription id
 * and push token identify a device and must not end up in a log, a crash report
 * or a support screenshot.
 */
export interface PushDiagnostics {
  initState: OneSignalInitState;
  initialized: boolean;
  externalIdMatchesUser: boolean;
  subscriptionIdAvailable: boolean;
  hasPushToken: boolean;
  optedIn: boolean;
  permissionGranted: boolean;
}

export const buildPushDiagnostics = (
  input: PushDiagnosticsInput
): PushDiagnostics => ({
  initState: input.initState,
  initialized: input.initState === 'initialized',
  externalIdMatchesUser: Boolean(
    input.userId && input.externalId === input.userId
  ),
  subscriptionIdAvailable: Boolean(input.subscriptionId),
  hasPushToken: input.hasPushToken === true,
  optedIn: input.optedIn === true,
  permissionGranted: input.permissionGranted === true,
});

export const formatPushDiagnostics = (diagnostics: PushDiagnostics): string =>
  `[onesignal:diag] ${JSON.stringify(diagnostics)}`;
