/**
 * Maps OneSignal's permission answers to the states the UI understands.
 *
 * OneSignal reports two booleans instead of a single status: whether push is
 * granted and whether asking would still show the system dialog. Android 12 and
 * below always report granted (no runtime permission exists), so `prompt` only
 * ever appears on 13+.
 */
export type NativePushStatus = 'unsupported' | 'prompt' | 'granted' | 'denied';

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
 * Permission is only ever requested from a deliberate user action. Once denied,
 * Android will not show the dialog again, so the UI must point at the system
 * settings instead of re-prompting.
 */
export const canRequestNativePermission = (status: NativePushStatus): boolean =>
  status === 'prompt';

/** Registering a device needs both permission and a signed-in user. */
export const shouldLinkPushToUser = (
  status: NativePushStatus,
  userId: string | null | undefined
): boolean => status === 'granted' && Boolean(userId);
