import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { CapgoUpdaterAdapter } from './capgoUpdater';
import { stripReloadMarker } from './cacheRecovery';
import { createOtaController, type OtaController } from './controller';
import { subscribeExamActivity } from './examActivity';
import type {
  ActivationDecision,
  AuthSnapshot,
  OtaSnapshot,
} from './types';

type UpdateContextValue = OtaSnapshot & {
  activate: () => Promise<ActivationDecision>;
  checkForUpdate: (manual?: boolean) => Promise<void>;
  dismissNotice: () => void;
  /** Idempotent: safe to await from a manual action before checking. */
  initialize: () => Promise<void>;
  /** Current controller state, for callers that need it right after an await. */
  getSnapshot: () => OtaSnapshot;
  restoreBuiltin: () => Promise<boolean>;
  reloadCurrent: () => Promise<boolean>;
};

const UpdateContext = createContext<UpdateContextValue | null>(null);

export const UpdateProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const authRef = useRef<{ loading: boolean; userId: string | null }>({
    loading,
    userId: user?.id ?? null,
  });
  authRef.current = { loading, userId: user?.id ?? null };

  const controllerRef = useRef<OtaController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = createOtaController({
      adapter: new CapgoUpdaterAdapter(),
      getAuth: (): AuthSnapshot => {
        const auth = authRef.current;
        if (auth.userId) {
          return { state: 'authenticated', userId: auth.userId };
        }
        if (auth.loading) return { state: 'unknown', userId: null };
        return { state: 'anonymous', userId: null };
      },
      getPathname: () =>
        typeof window === 'undefined' ? undefined : window.location.pathname,
    });
  }

  const controller = controllerRef.current;
  const [snapshot, setSnapshot] = useState<OtaSnapshot>(
    controller.getSnapshot()
  );

  useEffect(() => {
    const unsubscribe = controller.subscribe(setSnapshot);
    const unsubscribeActivity = subscribeExamActivity(() => {
      controller.handleExamActivityChange();
    });
    const onVisibility = () => {
      if (document.visibilityState === 'visible') controller.handleForeground();
    };
    const onOnline = () => controller.handleOnline();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    void controller.initialize();

    // A hard reload appends a cache-busting parameter; drop it once the app is up.
    stripReloadMarker({ location: window.location, history: window.history });

    return () => {
      unsubscribe();
      unsubscribeActivity();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
    };
  }, [controller]);

  useEffect(() => {
    controller.handleAuthChange();
  }, [controller, loading, user?.id]);

  useEffect(() => {
    controller.handleExamActivityChange();
  }, [controller, location.pathname]);

  const activate = useCallback(() => controller.activate(), [controller]);
  const checkForUpdate = useCallback(
    (manual = false) => controller.checkForUpdate(manual),
    [controller]
  );
  const dismissNotice = useCallback(
    () => controller.dismissNotice(),
    [controller]
  );
  const initialize = useCallback(() => controller.initialize(), [controller]);
  const getSnapshot = useCallback(() => controller.getSnapshot(), [controller]);
  const restoreBuiltin = useCallback(
    () => controller.restoreBuiltin(),
    [controller]
  );
  const reloadCurrent = useCallback(
    () => controller.reloadCurrent(),
    [controller]
  );

  const value = useMemo<UpdateContextValue>(
    () => ({
      ...snapshot,
      activate,
      checkForUpdate,
      dismissNotice,
      initialize,
      getSnapshot,
      restoreBuiltin,
      reloadCurrent,
    }),
    [
      snapshot,
      activate,
      checkForUpdate,
      dismissNotice,
      initialize,
      getSnapshot,
      restoreBuiltin,
      reloadCurrent,
    ]
  );

  return (
    <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>
  );
};

export const useOta = (): UpdateContextValue => {
  const value = useContext(UpdateContext);
  if (!value) {
    throw new Error('useOta must be used within an UpdateProvider');
  }
  return value;
};
