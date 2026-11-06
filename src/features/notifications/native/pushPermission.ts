/**
 * Maps Firebase Messaging permission answers to the states the UI understands.
 *
 * The plugin reports one status instead of two booleans, so `prompt` covers both
 * "never asked" and "Android can still show the dialog", and `denied` means the
 * system screen is the only way back.
 */
export type NativePushStatus = 'unsupported' | 'prompt' | 'granted' | 'denied';

/**
 * Why the plugin is or is not running. Distinguishing "no plugin" from "failed"
 * matters: an APK built before the plugin existed looks identical to a working
 * app until a push never arrives.
 */
export type FcmInitState =
  | 'plugin_unavailable'
  | 'pending'
  | 'initialized'
  | 'failed';

export const toNativePushStatus = (state: {
  receive?: unknown;
}): NativePushStatus => {
  const receive = String(state.receive ?? '').trim();

  if (receive === 'granted') return 'granted';
  if (receive === 'denied') return 'denied';
  if (receive === 'prompt' || receive === 'prompt-with-rationale') {
    return 'prompt';
  }

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
 * The one-time first-launch prompt. It is skipped when the user already answered
 * on a previous launch or deliberately turned notifications off, so a reinstall
 * is not required to make the dialog stop appearing.
 */
export const shouldAskOnFirstLaunch = (
  status: NativePushStatus,
  alreadyAsked: boolean,
  userDisabled: boolean
): boolean => status === 'prompt' && !alreadyAsked && !userDisabled;

/** What the device reports about this installation right now. */
export interface PushRegistrationSnapshot {
  token: string | null;
}

/**
 * Granted permission is not a registered device: without an FCM token the
 * backend has no address to deliver to, and the token can arrive seconds after
 * the permission dialog closes.
 */
export const isNativePushRegistered = (
  snapshot: PushRegistrationSnapshot | null
): boolean => Boolean(snapshot?.token?.trim());

export interface PushDiagnosticsInput {
  initState: FcmInitState;
  hasToken: boolean;
  permissionGranted: boolean;
}

/**
 * Diagnostics describe state, never the state's contents: the FCM token is a
 * credential that identifies a device, so it must not end up in a log, a crash
 * report or a support screenshot.
 */
export interface PushDiagnostics {
  initState: FcmInitState;
  initialized: boolean;
  hasToken: boolean;
  permissionGranted: boolean;
}

export const buildPushDiagnostics = (
  input: PushDiagnosticsInput
): PushDiagnostics => ({
  initState: input.initState,
  initialized: input.initState === 'initialized',
  hasToken: input.hasToken === true,
  permissionGranted: input.permissionGranted === true,
});

export const formatPushDiagnostics = (diagnostics: PushDiagnostics): string =>
  `[fcm:diag] ${JSON.stringify(diagnostics)}`;
