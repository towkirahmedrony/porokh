import { createContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/shared/lib/supabase';
import { buildApiUrl } from '@/shared/lib/apiConfig';
import { purgePersistedQueryCache } from '@/shared/lib/queryClient';
import { authService } from '../services/authService';
import type { AppUser, AuthContextType, ProfileStatus } from '../types/auth';
import {
  applyCachedProfile,
  isSameAppUser,
  isSameSession,
  mergeSessionUser,
  needsProfileEnrichment,
} from '../utils/authSessionSync';
import {
  clearCachedProfile,
  normalizeCachedProfile,
  readCachedProfile,
  writeCachedProfile,
} from '../utils/profileCache';
import { isSessionBeyondOfflineGrace } from '../utils/offlineSession';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
const SUSPENDED_SESSION_KEY = 'parapoth:suspended-session-id';

const getSessionId = (accessToken?: string) => {
  try {
    const payload = accessToken?.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(normalized)) as { session_id?: unknown };
    return typeof claims.session_id === 'string' ? claims.session_id : null;
  } catch {
    return null;
  }
};

const readSuspendedSessionId = () => {
  try {
    return window.sessionStorage.getItem(SUSPENDED_SESSION_KEY);
  } catch {
    return null;
  }
};

const clearSuspendedSessionId = () => {
  try {
    window.sessionStorage.removeItem(SUSPENDED_SESSION_KEY);
  } catch {
    // State enforcement remains in the backend if storage is unavailable.
  }
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string>('student');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  // The flag lives only in the profile row. Until that row has been read the
  // gate must render a loader; "unknown" is never "not onboarded".
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>('idle');
  const [profileError, setProfileError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const roleFetchRef = useRef(false);
  const activeUserIdRef = useRef<string | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const roleRef = useRef<string>('student');
  // The user whose profile row has already been merged into state. Enrichment is
  // keyed to a user id, never to an auth event, so token refreshes cannot reset
  // the name/avatar back to "loading".
  const enrichedUserIdRef = useRef<string | null>(null);
  const profileRequestRef = useRef<string | null>(null);
  const roleUserIdRef = useRef<string | null>(null);
  // The user whose cached profile row has already been merged into state. While
  // it matches, a failed network read is a refresh failure, never an unknown
  // identity, so the gate keeps rendering the app instead of an error screen.
  const cachedProfileUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  const enrichUserWithProfile = useCallback(async (authUser: AppUser | null) => {
    if (!authUser?.id || !mountedRef.current) return;
    // Never run two reads for the same user (StrictMode, retry + auth event).
    if (profileRequestRef.current === authUser.id) return;

    profileRequestRef.current = authUser.id;
    enrichedUserIdRef.current = authUser.id;

    // A cached row already answered the questions this gate needs, so the
    // refresh must not put the app back into a blocking loading state. Without
    // this, every launch waited for the network before the dashboard could
    // render — the offline failure this cache exists to remove.
    const hasCachedProfile = cachedProfileUserIdRef.current === authUser.id;
    if (!hasCachedProfile) {
      setProfileStatus('loading');
    }
    setProfileError(null);

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select(
          'id, username, full_name, avatar_url, institution, total_xp, language_preference, class_level, group, study_goal, onboarding_completed_at'
        )
        .eq('id', authUser.id)
        .single();

      if (error || !profile) {
        throw error ?? new Error('Profile row not found');
      }

      // The account changed while this read was in flight; the new user's
      // enrichment owns the state now.
      if (!mountedRef.current || activeUserIdRef.current !== authUser.id) return;

      // Keep the row on the device for the next cold start. Failure to write is
      // handled inside StorageUtils (quota/private mode) and never blocks the
      // in-memory profile below.
      writeCachedProfile(
        authUser.id,
        normalizeCachedProfile(profile as unknown as Record<string, unknown>)
      );
      cachedProfileUserIdRef.current = authUser.id;

      setUser(prev => {
        if (!prev || prev.id !== authUser.id) return prev;

        return {
          ...prev,
          username: profile.username ?? (prev as any).username ?? null,
          full_name: profile.full_name ?? (prev as any).full_name ?? null,
          avatar_url: profile.avatar_url ?? (prev as any).avatar_url ?? null,
          institution: profile.institution ?? (prev as any).institution ?? null,
          language_preference: profile.language_preference ?? (prev as any).language_preference ?? 'bn',
          class_level: profile.class_level ?? null,
          group: profile.group ?? null,
          study_goal: profile.study_goal ?? null,
          onboarding_completed_at: profile.onboarding_completed_at ?? null,
          total_xp: profile.total_xp ?? 0,
          total_score: profile.total_xp ?? 0
        } as AppUser;
      });
      setProfileStatus('ready');
    } catch (error) {
      if (!mountedRef.current || activeUserIdRef.current !== authUser.id) return;
      // Leave the flag unknown instead of guessing "not onboarded". A retry or
      // the next auth event may read the row again.
      enrichedUserIdRef.current = null;
      const cachedAnswer = cachedProfileUserIdRef.current === authUser.id;
      // With a cached row the gate already has its answer; a failed refresh is
      // reported but must not replace the dashboard with an error screen.
      setProfileStatus(cachedAnswer ? 'ready' : 'error');
      setProfileError(error instanceof Error ? error.message : 'Profile load failed');
      console.warn('Profile enrichment failed:', error);
    } finally {
      if (profileRequestRef.current === authUser.id) {
        profileRequestRef.current = null;
      }
    }
  }, []);

  const fetchRoleData = useCallback(async () => {
    if (roleFetchRef.current || !mountedRef.current) return;

    roleFetchRef.current = true;

    try {
      const result = await authService.getRoleAndPermissions();
      if (!mountedRef.current) return;

      setRole(result?.role || 'student');
      setPermissions(result?.permissions || []);
    } catch (error) {
      console.warn('Role fetch failed, fallback to student:', error);
      if (!mountedRef.current) return;
      setRole('student');
      setPermissions([]);
    } finally {
      roleFetchRef.current = false;
    }
  }, []);

  const updateUserProfile = useCallback((
    userId: string,
    profile: Partial<
      Pick<
        AppUser,
        | 'full_name'
        | 'username'
        | 'avatar_url'
        | 'class_level'
        | 'group'
        | 'study_goal'
        | 'onboarding_completed_at'
      >
    >
  ) => {
    setUser((current) => current?.id === userId ? { ...current, ...profile } : current);
  }, []);

  /**
   * Mirrors a language change into the cached auth user. Without this the
   * profile still carried the previous value after the switch, so any later
   * profile reconciliation would silently revert the UI language.
   */
  const setLanguagePreference = useCallback((language: 'bn' | 'en') => {
    setUser((current) =>
      current
        ? { ...current, language_preference: language }
        : current
    );
  }, []);

  const applySession = useCallback((currentSession: Session | null) => {
    if (currentSession) {
      const currentSessionId = getSessionId(currentSession.access_token);
      const suspendedSessionId = readSuspendedSessionId();
      if (currentSessionId && currentSessionId === suspendedSessionId) {
        sessionRef.current = null;
        activeUserIdRef.current = null;
        enrichedUserIdRef.current = null;
        roleUserIdRef.current = null;
        setSession(null);
        setUser(null);
        setProfileStatus('idle');
        setProfileError(null);
        setRole('student');
        setPermissions([]);
        setLoading(false);
        return;
      }
      if (suspendedSessionId && currentSessionId !== suspendedSessionId) {
        clearSuspendedSessionId();
      }
    } else {
      clearSuspendedSessionId();
    }

    sessionRef.current = currentSession;

    // Supabase builds a new session object for every getSession() call and every
    // auth event. Commit it only when its values changed, otherwise each
    // notification would schedule another render.
    setSession((previous) =>
      isSameSession(previous, currentSession) ? previous : currentSession
    );

    const nextUserId = currentSession?.user.id ?? null;

    if (!nextUserId) {
      // The session is gone (sign-out, revocation, grace expiry): nothing this
      // account cached may stay readable on the device.
      const signedOutUserId = activeUserIdRef.current;
      if (signedOutUserId) {
        clearCachedProfile(signedOutUserId);
        purgePersistedQueryCache();
      }

      activeUserIdRef.current = null;
      enrichedUserIdRef.current = null;
      cachedProfileUserIdRef.current = null;
      roleUserIdRef.current = null;
      setUser(null);
      setProfileStatus('idle');
      setProfileError(null);
      setRole('student');
      setPermissions([]);
      setLoading(false);
      return;
    }

    const baseUser = {
      ...(currentSession!.user as AppUser),
      total_xp: (currentSession!.user as any)?.total_xp ?? 0,
      total_score: (currentSession!.user as any)?.total_score ?? 0
    } as AppUser;

    // A different account replaced the previous session without a sign-out
    // (shared phone, expired session, provider switch). Nothing the previous
    // account cached may survive into the next one.
    const previousUserId = activeUserIdRef.current;
    if (previousUserId && previousUserId !== nextUserId) {
      clearCachedProfile(previousUserId);
      cachedProfileUserIdRef.current = null;
      purgePersistedQueryCache();
    }

    activeUserIdRef.current = nextUserId;

    // Restore the last known profile row before touching the network. This is
    // what lets an offline cold start resolve the onboarding gate and render
    // the dashboard; the network read below then reconciles it in background.
    const cachedProfile = readCachedProfile(nextUserId);

    setUser((previous) => {
      const merged = mergeSessionUser(baseUser, previous);
      const hydrated = cachedProfile
        ? applyCachedProfile(merged, cachedProfile)
        : merged;
      return isSameAppUser(previous, hydrated) ? previous : hydrated;
    });

    if (cachedProfile) {
      cachedProfileUserIdRef.current = nextUserId;
      setProfileStatus('ready');
      setProfileError(null);
    }

    setLoading(false);

    if (needsProfileEnrichment(enrichedUserIdRef.current, nextUserId)) {
      void enrichUserWithProfile(baseUser);
    }

    if (roleUserIdRef.current !== nextUserId) {
      roleUserIdRef.current = nextUserId;
      void fetchRoleData();
    }
  }, [enrichUserWithProfile, fetchRoleData]);

  const refreshProfile = useCallback(() => {
    const currentSession = sessionRef.current;
    if (!currentSession?.user?.id) return;

    enrichedUserIdRef.current = null;
    void enrichUserWithProfile(currentSession.user as AppUser);
  }, [enrichUserWithProfile]);

  const signOut = useCallback(async () => {
    // Captured before the SDK emits SIGNED_OUT, because that event already
    // resets the refs this cleanup needs to identify the account.
    const signingOutUserId = activeUserIdRef.current ?? sessionRef.current?.user?.id ?? null;
    try {
      setLoading(true);
      const currentSession = sessionRef.current;
      if (currentSession?.access_token && (roleRef.current === 'admin' || roleRef.current === 'super_admin')) {
        const apiBase = buildApiUrl('/auth/logout');
        try {
          await fetch(apiBase, {
            method: 'POST',
            headers: { Authorization: `Bearer ${currentSession.access_token}` },
          });
        } catch {
          // Best effort: Supabase sign-out still runs if the API is unavailable.
        }
      }
      // A native installation must stop receiving this account's pushes before
      // the session disappears: the deactivation call needs the bearer token.
      try {
        const { unregisterNativePushOnSignOut } = await import(
          '@/features/notifications/native/nativePush'
        );
        await unregisterNativePushOnSignOut();
      } catch {
        // Best effort: cleanup must never block signing out.
      }

      const { error } = await supabase.auth.signOut();
      if (error) {
        // Offline (or with the server unreachable) a global sign-out cannot
        // revoke the refresh token. Dropping the local session is still the
        // correct answer: this device must stop opening the account, and the
        // token is unusable once the device is back online without the session.
        console.warn('Global sign-out failed; clearing the local session:', error.message);
        const { error: localError } = await supabase.auth.signOut({ scope: 'local' });
        if (localError) throw localError;
      }

      // Account-scoped local data must not outlive the session on this device.
      clearCachedProfile(signingOutUserId);
      purgePersistedQueryCache();

      sessionRef.current = null;
      setSession(null);
      setUser(null);
      activeUserIdRef.current = null;
      enrichedUserIdRef.current = null;
      cachedProfileUserIdRef.current = null;
      roleUserIdRef.current = null;
      setProfileStatus('idle');
      setProfileError(null);
      setRole('student');
      setPermissions([]);
    } catch (error) {
      // The session is still the user's own when both sign-out calls failed, so
      // its cached data is left intact; the signed-out branch above performs
      // the purge as soon as the session actually disappears.
      console.error('Logout failed:', error);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const handleUnauthorized = () => {
      console.warn('Unauthorized event received. Clearing auth state...');
      void signOut();
    };

    const handleSuspended = () => {
      // Hide this session in the app without calling Supabase signOut, which
      // may revoke a provider session. The backend remains authoritative.
      const sessionId = getSessionId(sessionRef.current?.access_token);
      if (sessionId) {
        try {
          window.sessionStorage.setItem(SUSPENDED_SESSION_KEY, sessionId);
        } catch {
          // State enforcement remains in the backend if storage is unavailable.
        }
      }
      sessionRef.current = null;
      setSession(null);
      setUser(null);
      setProfileStatus('idle');
      setProfileError(null);
      setRole('student');
      setPermissions([]);
      setLoading(false);
      activeUserIdRef.current = null;
      enrichedUserIdRef.current = null;
      cachedProfileUserIdRef.current = null;
      roleUserIdRef.current = null;
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    window.addEventListener('auth:suspended', handleSuspended);

    const init = async () => {
      try {
        const {
          data: { session: initialSession },
          error
        } = await supabase.auth.getSession();

        if (error) throw error;
        if (!mountedRef.current) return;

        // A session restored from storage is normally refreshed by the SDK, but
        // that refresh needs the network. Offline the stored token is honoured
        // for reads and syncs once the device is back online; only a session
        // abandoned far past its expiry is discarded so a stolen device cannot
        // keep an old account open forever.
        if (initialSession && isSessionBeyondOfflineGrace(initialSession)) {
          console.warn(
            'Stored session is beyond the offline grace window; requiring a fresh sign-in.'
          );
          try {
            await supabase.auth.signOut({ scope: 'local' });
          } catch (signOutError) {
            console.warn('Local sign-out failed:', signOutError);
          }
          if (!mountedRef.current) return;
          applySession(null);
          return;
        }

        applySession(initialSession);
      } catch (error) {
        console.error('Auth initialization failed:', error);
        if (!mountedRef.current) return;
        setProfileStatus('idle');
        setLoading(false);
      }
    };

    void init();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!mountedRef.current) return;
      applySession(currentSession);
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
      window.removeEventListener('auth:suspended', handleSuspended);
    };
    // `applySession` and `signOut` are stable (refs instead of session state),
    // so this lifecycle effect runs once per mount. Depending on `session` here
    // made every getSession() result re-run init() -> applySession() ->
    // setSession(new object) -> effect again, which flickered the whole app.
  }, [applySession, signOut]);

  /**
   * Connectivity recovery.
   *
   * React Query resumes its own paused queries on reconnect, but the session
   * and the profile row are outside that cache. A token that expired while the
   * device was offline is refreshed here, and a profile that could only be
   * answered from cache is reconciled with the server. Nothing is reloaded and
   * no request is issued when there is nothing stale to fix.
   */
  useEffect(() => {
    const handleOnline = () => {
      const current = sessionRef.current;
      if (!current) return;

      const expiresSoon =
        typeof current.expires_at === 'number' &&
        current.expires_at * 1000 - Date.now() < 60_000;

      if (expiresSoon) {
        void supabase.auth.refreshSession().catch((error) => {
          console.warn('Session refresh on reconnect failed:', error);
        });
      }

      if (enrichedUserIdRef.current !== current.user.id) {
        refreshProfile();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [refreshProfile]);

  const value = useMemo<AuthContextType>(() => ({
    session,
    user,
    role,
    permissions,
    loading,
    profileStatus,
    profileError,
    refreshProfile,
    updateUserProfile,
    setLanguagePreference,
    signOut
  }), [session, user, role, permissions, loading, profileStatus, profileError, refreshProfile, updateUserProfile, setLanguagePreference, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
