import type { Session } from '@supabase/supabase-js';

const RECOVERY_SESSION_KEY = 'parapoth:password-recovery-session';

type RecoveryGrant = {
  userId: string;
  sessionId: string;
  expiresAt: number;
  /** When the SDK confirmed the recovery link; used to avoid bouncing a
   *  returning visitor back to the reset screen on every later reload. */
  createdAt?: number;
};

/** A recovery redirect is only auto-applied shortly after the link was opened. */
export const RECOVERY_MARKER_FRESHNESS_MS = 15 * 60 * 1000;

type RecoverySession = Pick<Session, 'user' | 'access_token' | 'expires_at'>;

const getSessionId = (accessToken: string): string | null => {
  try {
    const payload = accessToken.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(normalized)) as { session_id?: unknown };
    return typeof decoded.session_id === 'string' ? decoded.session_id : null;
  } catch {
    return null;
  }
};

export function rememberPasswordRecoverySession(session: RecoverySession): void {
  if (typeof window === 'undefined' || !session.user?.id) return;
  const sessionId = getSessionId(session.access_token);
  if (!sessionId) return;

  const grant: RecoveryGrant = {
    userId: session.user.id,
    sessionId,
    expiresAt: (session.expires_at ?? 0) * 1000,
    createdAt: Date.now(),
  };

  try {
    window.sessionStorage.setItem(RECOVERY_SESSION_KEY, JSON.stringify(grant));
  } catch {
    // A blocked sessionStorage must not be treated as recovery authorization.
  }
}

export function hasPasswordRecoverySession(session: RecoverySession | null): boolean {
  if (!session?.user?.id || typeof window === 'undefined') return false;
  const sessionId = getSessionId(session.access_token);
  if (!sessionId) return false;

  try {
    const raw = window.sessionStorage.getItem(RECOVERY_SESSION_KEY);
    if (!raw) return false;
    const grant = JSON.parse(raw) as RecoveryGrant;
    return (
      grant.userId === session.user.id &&
      grant.sessionId === sessionId &&
      Number.isFinite(grant.expiresAt) &&
      grant.expiresAt > Date.now()
    );
  } catch {
    return false;
  }
}

/**
 * True only while the recovery link was verified recently in this tab. Used by
 * the global redirect so a stale marker cannot hijack normal navigation.
 */
export function hasRecentPasswordRecoverySession(
  session: RecoverySession | null
): boolean {
  if (!hasPasswordRecoverySession(session) || typeof window === 'undefined') {
    return false;
  }

  try {
    const raw = window.sessionStorage.getItem(RECOVERY_SESSION_KEY);
    if (!raw) return false;
    const grant = JSON.parse(raw) as RecoveryGrant;
    return (
      Number.isFinite(grant.createdAt) &&
      Date.now() - (grant.createdAt as number) < RECOVERY_MARKER_FRESHNESS_MS
    );
  } catch {
    return false;
  }
}

export function clearPasswordRecoverySession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(RECOVERY_SESSION_KEY);
  } catch {
    // Clearing a marker is best-effort when browser storage is unavailable.
  }
}
