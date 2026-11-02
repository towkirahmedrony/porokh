/**
 * Where the root route ("/") sends the user.
 *
 * The website and PWA keep the public marketing homepage at "/". Only the
 * Capacitor app starts on the app itself, so the decision lives here instead of
 * a global redirect in the router.
 *
 * While Supabase is still restoring the persisted session the answer is
 * "loading", never "signed out": an optimistic answer would either flash the
 * marketing homepage for a signed-in user or the login form for a user whose
 * token has simply not been read yet. The decision only reads auth state, so an
 * offline launch with a restored session is not treated as logged out.
 */
export type NativeStartScreen = 'landing' | 'loading' | 'dashboard' | 'login';

export interface NativeStartInput {
  /** True inside the Capacitor shell (Android APK / OTA bundle). */
  native: boolean;
  /** AuthProvider has not finished restoring the persisted session yet. */
  authLoading: boolean;
  userId: string | null;
}

export function decideNativeStart({
  native,
  authLoading,
  userId,
}: NativeStartInput): NativeStartScreen {
  if (!native) return 'landing';

  if (authLoading) return 'loading';

  return userId ? 'dashboard' : 'login';
}
