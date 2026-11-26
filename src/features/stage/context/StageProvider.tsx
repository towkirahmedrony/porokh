import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { App as CapacitorApp } from '@capacitor/app';

import { useAuth } from '@/features/auth/hooks/useAuth';
import type { StudyGoal } from '@/shared/lib/academic';
import { STORAGE_KEYS } from '@/shared/constants/storageKeys';
import { StorageUtils } from '@/shared/utils/storage';
import { stageService } from '../services/stageService';
import type { StageContextValue, StageResponse, StageState } from '../types/stage';
import {
  EMPTY_STAGE_STATE,
  readCachedStageState,
  stageResponseFromState,
  stageStateFromResponse,
} from '../utils/stage';

const StageContext = createContext<StageContextValue | null>(null);

const stageCacheKey = (userId: string) =>
  `${STORAGE_KEYS.STAGE_CACHE_PREFIX}${userId}` as const;

/**
 * Single source of truth for the student's stage.
 *
 * The stage is never derived here: it is whatever the server last said. The
 * cached answer is used until a fresh one arrives so the goal gate cannot flash
 * on a student it does not belong to, and a failed refresh keeps the last known
 * answer instead of guessing.
 */
export function StageProvider({ children }: { children: ReactNode }) {
  const { user, updateUserProfile } = useAuth();
  const userId = user?.id ?? null;

  const [state, setState] = useState<StageState>(EMPTY_STAGE_STATE);
  const requestRef = useRef<string | null>(null);
  const ownerRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const persist = useCallback((response: StageResponse, owner: string) => {
    const next = stageStateFromResponse(response);
    setState(next);

    const payload = stageResponseFromState(next);
    if (payload) StorageUtils.set(stageCacheKey(owner), payload);
  }, []);

  // Adopt the cached answer for this account, or wait for the first read.
  useEffect(() => {
    if (!userId) {
      ownerRef.current = null;
      setState(EMPTY_STAGE_STATE);
      return;
    }

    ownerRef.current = userId;
    const cached = readCachedStageState(StorageUtils.get<unknown>(stageCacheKey(userId)));

    setState(
      cached
        ? { ...cached, status: 'ready' }
        : { ...EMPTY_STAGE_STATE, status: 'loading' }
    );
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    // One read in flight per account; resume storms must not stack requests.
    if (requestRef.current === userId) return;

    requestRef.current = userId;
    setState((prev) => ({ ...prev, status: prev.stage ? prev.status : 'loading' }));

    try {
      const response = await stageService.getStage();
      if (!mountedRef.current || ownerRef.current !== userId) return;
      persist(response, userId);
    } catch {
      if (!mountedRef.current || ownerRef.current !== userId) return;
      // Keep the last answer. A network failure is not a stage change.
      setState((prev) => ({ ...prev, status: 'error' }));
    } finally {
      if (requestRef.current === userId) requestRef.current = null;
    }
  }, [persist, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // The exam date can be changed by an admin while the app is in the
  // background, so a resume is the moment the gate must be re-evaluated.
  useEffect(() => {
    if (!userId) return;

    let disposed = false;
    let remove: (() => void) | undefined;

    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void refresh();
    }).then((handle) => {
      if (disposed) void handle.remove();
      else remove = () => void handle.remove();
    });

    return () => {
      disposed = true;
      remove?.();
    };
  }, [refresh, userId]);

  // A signed-out device keeps no stage for the next account.
  useEffect(() => {
    if (userId) return;
    const owner = ownerRef.current;
    if (owner) StorageUtils.remove(stageCacheKey(owner));
  }, [userId]);

  const setGoal = useCallback(
    async (goal: StudyGoal) => {
      if (!userId) throw new Error('Not signed in');

      const response = await stageService.setGoal(goal);
      persist(response, userId);
      updateUserProfile(userId, { study_goal: response.goal ?? goal });
    },
    [persist, updateUserProfile, userId]
  );

  return (
    <StageContext.Provider value={{ ...state, refresh, setGoal }}>
      {children}
    </StageContext.Provider>
  );
}

export const useStageContext = (): StageContextValue => {
  const context = useContext(StageContext);
  if (!context) {
    throw new Error('useStage must be used inside <StageProvider>');
  }
  return context;
};
