import type { AppMessageKey } from '@/shared/i18n/messages';

export const AUTH_CALLBACK_PATH = '/auth/callback';
export const NATIVE_AUTH_SCHEME = 'net.porokh.app';
export const NATIVE_AUTH_HOST = 'auth';
export const NATIVE_AUTH_PATH = '/callback';
export const NATIVE_AUTH_CALLBACK_URL = `${NATIVE_AUTH_SCHEME}://${NATIVE_AUTH_HOST}${NATIVE_AUTH_PATH}`;

export const OAUTH_ERROR_EVENT = 'auth:oauth-error';

export type OAuthErrorMessageKey = Extract<
  AppMessageKey,
  'auth.google.cancelled' | 'auth.google.failed'
>;

export type OAuthCallbackParseResult =
  | { kind: 'code'; code: string }
  | { kind: 'error'; messageKey: OAuthErrorMessageKey }
  | { kind: 'ignored' };

/**
 * Web keeps the production callback route. Native must leave the WebView for a
 * custom scheme, because `window.location.origin` there is `https://localhost`
 * and no browser can reach it after the OAuth provider redirects.
 */
export function buildOAuthRedirectUrl(origin: string, isNative: boolean): string {
  if (isNative) return NATIVE_AUTH_CALLBACK_URL;

  return `${origin.replace(/\/+$/, '')}${AUTH_CALLBACK_PATH}`;
}

export interface GoogleOAuthOptions {
  redirectTo: string;
  skipBrowserRedirect: boolean;
  queryParams: { prompt: string };
}

export function buildGoogleOAuthOptions(
  origin: string,
  isNative: boolean
): GoogleOAuthOptions {
  return {
    redirectTo: buildOAuthRedirectUrl(origin, isNative),
    skipBrowserRedirect: isNative,
    queryParams: { prompt: 'select_account' },
  };
}

/**
 * Accepts only the exact native callback. A URL from another scheme, host or
 * path is ignored instead of being treated as an authenticated redirect.
 */
export function parseOAuthCallbackUrl(rawUrl: string): OAuthCallbackParseResult {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    return { kind: 'ignored' };
  }

  if (
    url.protocol !== `${NATIVE_AUTH_SCHEME}:` ||
    url.hostname !== NATIVE_AUTH_HOST ||
    url.pathname !== NATIVE_AUTH_PATH
  ) {
    return { kind: 'ignored' };
  }

  const params = new URLSearchParams(url.search);
  const error = params.get('error');

  if (error) {
    return {
      kind: 'error',
      messageKey:
        error === 'access_denied' ? 'auth.google.cancelled' : 'auth.google.failed',
    };
  }

  // The native client uses the PKCE flow, so only an authorization code is
  // valid here. Implicit-flow tokens are deliberately not accepted.
  const code = params.get('code')?.trim();
  if (!code) return { kind: 'ignored' };

  return { kind: 'code', code };
}

export interface CallbackGuard {
  begin(key: string): boolean;
  finish(key: string): void;
}

/** Keeps a callback from being exchanged twice, including concurrent repeats. */
export function createCallbackGuard(): CallbackGuard {
  const handled = new Set<string>();
  let inFlight: string | null = null;

  return {
    begin(key) {
      if (!key || handled.has(key) || inFlight !== null) return false;

      inFlight = key;
      return true;
    },
    finish(key) {
      handled.add(key);
      if (inFlight === key) inFlight = null;
    },
  };
}

export interface NativeCallbackDeps {
  exchangeCodeForSession: (
    code: string
  ) => Promise<{ error: unknown | null }>;
  onSuccess: () => void | Promise<void>;
  onError: (messageKey: OAuthErrorMessageKey) => void;
}

export function createNativeCallbackHandler(
  deps: NativeCallbackDeps,
  guard: CallbackGuard = createCallbackGuard()
): (rawUrl: string) => Promise<void> {
  return async (rawUrl) => {
    const parsed = parseOAuthCallbackUrl(rawUrl);

    if (parsed.kind === 'ignored') return;

    if (parsed.kind === 'error') {
      deps.onError(parsed.messageKey);
      return;
    }

    if (!guard.begin(parsed.code)) return;

    try {
      const { error } = await deps.exchangeCodeForSession(parsed.code);
      if (error) throw error;
    } catch {
      // A failed code is not retried automatically: the same code cannot
      // succeed twice, and a repeat could only cause a second auth request.
      guard.finish(parsed.code);
      deps.onError('auth.google.failed');
      return;
    }

    guard.finish(parsed.code);
    await deps.onSuccess();
  };
}

let pendingOAuthError: OAuthErrorMessageKey | null = null;

/** Survives the cold-start mount gap before the login screen renders. */
export function setPendingOAuthError(messageKey: OAuthErrorMessageKey): void {
  pendingOAuthError = messageKey;
}

export function consumePendingOAuthError(): OAuthErrorMessageKey | null {
  const current = pendingOAuthError;
  pendingOAuthError = null;
  return current;
}
