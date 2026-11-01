import { createContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/shared/lib/supabase';
import { buildApiUrl } from '@/shared/lib/apiConfig';
import { authService } from '../services/authService';
import type { AppUser, AuthContextType } from '../types/auth';
import {
  isSameAppUser,
  isSameSession,
  mergeSessionUser,
  needsProfileEnrichment,
} from '../utils/authSessionSync';

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
  const [profileLoading, setProfileLoading] = useState<boolean>(false);

  const mountedRef = useRef(true);
  const roleFetchRef = useRef(false);
  const activeUserIdRef = useRef<string | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const roleRef = useRef<string>('student');
  // The user whose profile row has already been merged into state. Enrichment is
  // keyed to a user id, never to an auth event, so token refreshes cannot reset
  // the name/avatar back to "loading".
  const enrichedUserIdRef = useRef<string | null>(null);
  const roleUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  const enrichUserWithProfile = useCallback(async (authUser: AppUser | null) => {
    if (!authUser?.id || !mountedRef.current) return;

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select(
          'id, username, full_name, avatar_url, institution, total_xp, language_preference, class_level, group, study_goal, onboarding_completed_at'
        )
        .eq('id', authUser.id)
        .single();

      if (error || !profile) {
        // Allow a later auth event to retry, but never on every render.
        if (activeUserIdRef.current === authUser.id) {
          enrichedUserIdRef.current = null;
        }
        return;
      }

      if (!mountedRef.current) return;

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
    } catch (error) {
      console.warn('Profile enrichment failed:', error);
    } finally {
      if (mountedRef.current && activeUserIdRef.current === authUser.id) {
        setProfileLoading(false);
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
        setProfileLoading(false);
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
      activeUserIdRef.current = null;
      enrichedUserIdRef.current = null;
      roleUserIdRef.current = null;
      setUser(null);
      setProfileLoading(false);
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

    activeUserIdRef.current = nextUserId;

    setUser((previous) => {
      const merged = mergeSessionUser(baseUser, previous);
      return isSameAppUser(previous, merged) ? previous : merged;
    });

    setLoading(false);

    if (needsProfileEnrichment(enrichedUserIdRef.current, nextUserId)) {
      enrichedUserIdRef.current = nextUserId;
      setProfileLoading(true);
      void enrichUserWithProfile(baseUser);
    }

    if (roleUserIdRef.current !== nextUserId) {
      roleUserIdRef.current = nextUserId;
      void fetchRoleData();
    }
  }, [enrichUserWithProfile, fetchRoleData]);

  const signOut = useCallback(async () => {
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
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      sessionRef.current = null;
      setSession(null);
      setUser(null);
      activeUserIdRef.current = null;
      enrichedUserIdRef.current = null;
      roleUserIdRef.current = null;
      setProfileLoading(false);
      setRole('student');
      setPermissions([]);
    } catch (error) {
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
      setProfileLoading(false);
      setRole('student');
      setPermissions([]);
      setLoading(false);
      activeUserIdRef.current = null;
      enrichedUserIdRef.current = null;
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

        applySession(initialSession);
      } catch (error) {
        console.error('Auth initialization failed:', error);
        if (!mountedRef.current) return;
        setProfileLoading(false);
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

  const value = useMemo<AuthContextType>(() => ({
    session,
    user,
    role,
    permissions,
    loading,
    profileLoading,
    updateUserProfile,
    setLanguagePreference,
    signOut
  }), [session, user, role, permissions, loading, profileLoading, updateUserProfile, setLanguagePreference, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
