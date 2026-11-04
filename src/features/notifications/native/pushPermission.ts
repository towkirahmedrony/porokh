/**
 * Maps the Capacitor permission result to the states the UI understands.
 *
 * Android 12 and below always report `granted` (there is no runtime
 * notification permission), so `prompt` only ever appears on 13+.
 */
export type NativePushStatus = 'unsupported' | 'prompt' | 'granted' | 'denied';

export const toNativePushStatus = (state: unknown): NativePushStatus => {
  if (state === 'granted') return 'granted';
  if (state === 'denied') return 'denied';
  if (state === 'prompt' || state === 'prompt-with-rationale') return 'prompt';
  return 'unsupported';
};

/**
 * Permission is only ever requested from a deliberate user action. Once denied,
 * Android will not show the dialog again, so the UI must point at the system
 * settings instead of re-prompting.
 */
export const canRequestNativePermission = (status: NativePushStatus): boolean =>
  status === 'prompt';

/** Registering needs both permission and a signed-in user to attach the token. */
export const shouldRegisterNativePush = (
  status: NativePushStatus,
  userId: string | null | undefined
): boolean => status === 'granted' && Boolean(userId);
