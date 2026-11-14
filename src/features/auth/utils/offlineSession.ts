import type { Session } from '@supabase/supabase-js';

/**
 * How long a persisted session may still open the app after its last access
 * token expiry while the device is offline.
 *
 * Supabase cannot refresh a token without a network round trip, so an offline
 * launch after an hour necessarily carries an expired access token. Refusing
 * that would log out every user who was offline for an hour, which is not what
 * an "expired token" means. Refusing *nothing* would keep a stolen, long-dead
 * session alive forever. The window below is the compromise: inside it the
 * cached session is honoured for offline use, outside it the app requires a
 * fresh sign-in.
 *
 * Every server call still presents the token, so nothing here bypasses
 * authorization; it only decides whether the cached shell may open.
 */
export const OFFLINE_SESSION_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * True when a persisted session is so far past its expiry that it must be
 * discarded instead of restored.
 *
 * A session without `expires_at` is left alone: that only happens on payloads
 * this app did not write, and guessing would be worse than the normal SDK
 * refresh path.
 */
export const isSessionBeyondOfflineGrace = (
  session: Pick<Session, 'expires_at'> | null | undefined,
  nowMs: number = Date.now()
): boolean => {
  const expiresAtSeconds = session?.expires_at;

  if (typeof expiresAtSeconds !== 'number' || !Number.isFinite(expiresAtSeconds)) {
    return false;
  }

  return nowMs > expiresAtSeconds * 1000 + OFFLINE_SESSION_GRACE_MS;
};

/**
 * True when the token has already expired but is still inside the grace window.
 * Used only for logging/diagnostics; the session is honoured either way.
 */
export const isSessionExpiredWithinGrace = (
  session: Pick<Session, 'expires_at'> | null | undefined,
  nowMs: number = Date.now()
): boolean => {
  const expiresAtSeconds = session?.expires_at;

  if (typeof expiresAtSeconds !== 'number' || !Number.isFinite(expiresAtSeconds)) {
    return false;
  }

  return (
    nowMs > expiresAtSeconds * 1000 &&
    !isSessionBeyondOfflineGrace(session, nowMs)
  );
};
