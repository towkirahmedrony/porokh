import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import type { Database } from '../types/supabase';
import {
  clearPasswordRecoverySession,
  rememberPasswordRecoverySession,
} from '@/features/auth/utils/passwordRecoverySession';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set at build time.'
  );
}

/**
 * Network bounds for Supabase calls.
 *
 * The SDK has no request timeout, and `auth.getSession()` awaits the session
 * restore — which includes a token refresh when the access token has expired.
 * Offline (or on a captive portal) that fetch can sit unresolved for minutes,
 * which is exactly the endless startup loader users report. Failing the refresh
 * fast is safe: the SDK keeps the stored session when the failure is a network
 * error and retries it on its own timer.
 *
 * Storage/function uploads keep the platform default: a large avatar upload on
 * a slow connection must not be aborted mid-flight.
 */
const AUTH_TIMEOUT_MS = 8000;
const REST_TIMEOUT_MS = 15000;

const withTimeout =
  (timeoutMs: number): typeof fetch =>
  async (input, init) => {
    // Respect a caller-provided signal: aborting someone else's request would
    // change cancellation semantics for that caller.
    if (init?.signal) return fetch(input, init);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };

const authFetch = withTimeout(AUTH_TIMEOUT_MS);
const restFetch = withTimeout(REST_TIMEOUT_MS);

const urlOf = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
};

/** Routes each Supabase namespace to a request bound appropriate for it. */
const boundedFetch: typeof fetch = (input, init) => {
  const url = urlOf(input);
  if (url.includes('/auth/v1/')) return authFetch(input, init);
  if (url.includes('/rest/v1/')) return restFetch(input, init);
  return fetch(input, init);
};

// The website keeps the existing implicit callback behaviour. The Android shell
// uses PKCE because its callback arrives through a custom scheme instead of a
// page load, so the authorization code must be exchanged explicitly.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: Capacitor.isNativePlatform() ? 'pkce' : 'implicit',
    detectSessionInUrl: true,
  },
  global: {
    fetch: boundedFetch,
  },
});

// Supabase consumes implicit-flow recovery tokens during client initialization
// and removes them from the URL before the password page may mount. Preserve a
// short-lived, session-bound marker from the SDK's verified recovery event.
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY' && session) {
    rememberPasswordRecoverySession(session);
  } else if (event === 'SIGNED_OUT') {
    clearPasswordRecoverySession();
  }
});
