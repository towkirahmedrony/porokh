import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { App as CapacitorApp } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import {
  FirebaseMessaging,
  type NotificationActionPerformedEvent,
  type NotificationReceivedEvent,
  type TokenReceivedEvent,
} from '@capacitor-firebase/messaging';
import toast from 'react-hot-toast';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { STORAGE_KEYS } from '@/shared/constants/storageKeys';
import { StorageUtils } from '@/shared/utils/storage';
import { markNotificationAsRead } from '../services/notificationService';
import {
  checkNativePushPermission,
  clearNativePushToken,
  deactivateNativePushDevice,
  getFcmInitState,
  initializeNativePush,
  isNativePushSupported,
  openNativeNotificationSettings,
  readNativePushToken,
  registerNativePushDevice,
  requestNativePushPermission,
} from './nativePush';
import {
  buildPushDiagnostics,
  canRequestNativePermission,
  formatPushDiagnostics,
  isNativePushRegistered,
  shouldAskOnFirstLaunch,
  type NativePushStatus,
} from './pushPermission';
import {
  DEFAULT_PUSH_TARGET,
  createTapDeduper,
  resolvePushTarget,
} from './pushRouting';

interface NativePushContextValue {
  /** False on the web and on APKs built before the plugin existed. */
  available: boolean;
  status: NativePushStatus;
  checking: boolean;
  busy: boolean;
  registered: boolean;
  error: string | null;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  openSettings: () => Promise<void>;
}

const NativePushContext = createContext<NativePushContextValue | null>(null);

const messageOf = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

/**
 * FCM data arrives untyped. Only string values are kept, because the payload
 * contract is string-only and anything else cannot be a route or an id.
 */
const readPayload = (
  notification: { data?: unknown } | null | undefined
): Record<string, string> => {
  const data = notification?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};

  const payload: Record<string, string> = {};
  Object.entries(data as Record<string, unknown>).forEach(([key, value]) => {
    if (typeof value === 'string') payload[key] = value;
  });
  return payload;
};

/**
 * An in-app disable is a user decision, not a transient state: it must survive a
 * restart and must not be undone by the resume or login effects.
 */
const isDeviceNotificationsDisabled = (): boolean =>
  StorageUtils.get<boolean>(STORAGE_KEYS.NATIVE_PUSH_DISABLED) === true;

const setDeviceNotificationsDisabled = (disabled: boolean): void => {
  StorageUtils.set(STORAGE_KEYS.NATIVE_PUSH_DISABLED, disabled);
};

const hasAskedForNativePush = (): boolean =>
  StorageUtils.get<boolean>(STORAGE_KEYS.NATIVE_PUSH_ASKED) === true;

const markNativePushAsked = (): void => {
  StorageUtils.set(STORAGE_KEYS.NATIVE_PUSH_ASKED, true);
};

/**
 * Owns the FCM lifecycle for the whole app:
 *
 * - the token is registered against the signed-in user, so an account switch
 *   re-binds the device and a sign-out detaches it
 * - a rotated token is re-registered instead of leaving a dead address behind
 * - foreground delivery → in-app toast (the tray is Android's job)
 * - taps → React Router, exactly once per notification id
 *
 * It asks once on first launch without blocking startup, then leaves every later
 * decision to the Settings card. A denial or an in-app disable is never silently
 * retried.
 */
export const NativePushProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const available = isNativePushSupported();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // `loading` is true until Supabase finishes restoring the stored session.
  // Without it the provider would detach a restored user on the first render.
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const userId = user?.id ?? null;

  const [status, setStatus] = useState<NativePushStatus>('unsupported');
  const [checking, setChecking] = useState(available);
  const [busy, setBusy] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigateRef = useRef(navigate);
  const tRef = useRef(t);
  const userIdRef = useRef<string | null>(userId);
  const acceptTapRef = useRef(createTapDeduper());
  const mountedRef = useRef(true);
  const retryTimerRef = useRef<number | null>(null);
  /** Last token accepted by the API, so a listener storm cannot re-post it. */
  const syncedTokenRef = useRef<string | null>(null);

  navigateRef.current = navigate;
  tRef.current = t;
  userIdRef.current = userId;

  const invalidateInbox = useCallback(() => {
    const currentUserId = userIdRef.current;
    void queryClient.invalidateQueries({
      queryKey: ['notifications', currentUserId],
    });
    void queryClient.invalidateQueries({
      queryKey: ['notifications', 'unreadCount', currentUserId],
    });
  }, [queryClient]);

  const clearRegistrationRetry = useCallback(() => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  /**
   * The token can arrive after the permission dialog closes. A short, single
   * retry covers that window without polling forever; a rotation event still
   * triggers its own verification.
   */
  const syncRegistrationRef = useRef<() => Promise<void>>(async () => undefined);

  const scheduleRegistrationRetry = useCallback(() => {
    if (retryTimerRef.current !== null) return;

    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null;
      void syncRegistrationRef.current();
    }, 2000);
  }, []);

  const refreshPermission = useCallback(async (): Promise<NativePushStatus> => {
    if (!available) {
      setChecking(false);
      return 'unsupported';
    }

    const next = await checkNativePushPermission();
    const token = await readNativePushToken();

    setStatus(next);
    setRegistered(isNativePushRegistered({ token }));
    setChecking(false);

    if (import.meta.env.DEV) {
      console.info(
        formatPushDiagnostics(
          buildPushDiagnostics({
            initState: getFcmInitState(),
            hasToken: Boolean(token),
            permissionGranted: next === 'granted',
          })
        )
      );
    }

    return next;
  }, [available]);

  /**
   * Reads the current token and registers it. Skips the network call when the
   * same token was already accepted, which keeps repeated listeners and resumes
   * from creating duplicate rows or duplicate registrations.
   */
  const syncRegistration = useCallback(async () => {
    const currentUserId = userIdRef.current;
    if (!currentUserId || isDeviceNotificationsDisabled()) return;

    const token = await readNativePushToken();
    if (!mountedRef.current) return;

    if (!token) {
      setRegistered(false);
      scheduleRegistrationRetry();
      return;
    }

    setRegistered(true);
    if (syncedTokenRef.current === token) return;

    try {
      await registerNativePushDevice(token);
      syncedTokenRef.current = token;
      if (mountedRef.current) setError(null);
    } catch (syncError) {
      if (!mountedRef.current) return;
      // A dropped network is retried; the token itself is still valid.
      setError(messageOf(syncError, 'device registration failed'));
      scheduleRegistrationRetry();
    }
  }, [scheduleRegistrationRetry]);

  syncRegistrationRef.current = syncRegistration;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearRegistrationRetry();
    };
  }, [clearRegistrationRetry]);

  // An APK without the plugin is not a web build: push is silently unavailable.
  useEffect(() => {
    if (!isNativePushSupported()) return;
    if (getFcmInitState() === 'plugin_unavailable') {
      console.warn('[fcm] the Firebase Messaging plugin is missing from this build; push is disabled.');
    }
  }, []);

  // One non-blocking prompt on the first launch. The marker is written before
  // asking, so StrictMode double effects and process restarts cannot show the
  // Android dialog twice. A user who already turned notifications off is left
  // alone, and later launches rely on the Settings card.
  useEffect(() => {
    if (!available) return;

    let cancelled = false;

    void (async () => {
      const ready = await initializeNativePush();
      if (!ready || cancelled) return;

      const permission = await checkNativePushPermission();
      if (cancelled) return;

      if (
        !shouldAskOnFirstLaunch(
          permission,
          hasAskedForNativePush(),
          isDeviceNotificationsDisabled()
        )
      ) {
        await refreshPermission();
        return;
      }

      markNativePushAsked();
      await requestNativePushPermission();
      if (cancelled) return;
      await refreshPermission();
    })();

    return () => {
      cancelled = true;
    };
  }, [available, refreshPermission]);

  // Listeners live for the app lifetime; handlers read refs so a navigation or
  // language change never re-binds them.
  useEffect(() => {
    if (!available) return;

    let cancelled = false;
    let bound = false;

    const showForegroundNotification = (
      title: string,
      body: string,
      target: string,
      notificationId: string
    ) => {
      toast.custom(
        (instance) => (
          <div
            onClick={() => {
              toast.dismiss(instance.id);
              if (notificationId) {
                void markNotificationAsRead(notificationId, true).catch(
                  () => undefined
                );
              }
              invalidateInbox();
              navigateRef.current(target);
            }}
            className={`${
              instance.visible ? 'animate-enter' : 'animate-leave'
            } pointer-events-auto flex w-full max-w-md cursor-pointer rounded-2xl border p-4 shadow-lg`}
            style={{
              backgroundColor: 'var(--dyn-card)',
              borderColor:
                'color-mix(in srgb, var(--dyn-text) 10%, transparent)',
            }}
          >
            <div className="flex-1">
              <p
                className="text-sm font-bold"
                style={{ color: 'var(--dyn-text)' }}
              >
                {title}
              </p>
              {body ? (
                <p
                  className="mt-1 text-sm"
                  style={{
                    color:
                      'color-mix(in srgb, var(--dyn-text) 70%, transparent)',
                  }}
                >
                  {body}
                </p>
              ) : null}
            </div>
          </div>
        ),
        { duration: 5000 }
      );
    };

    const handleTokenReceived = ({ token }: TokenReceivedEvent) => {
      const value = String(token ?? '').trim();
      if (!value) return;

      setRegistered(true);
      if (!userIdRef.current || isDeviceNotificationsDisabled()) return;

      // Rotated token: register it immediately so the old address is released.
      if (syncedTokenRef.current !== value) void syncRegistrationRef.current();
    };

    const handleNotificationReceived = ({
      notification,
    }: NotificationReceivedEvent) => {
      const payload = readPayload(notification);
      const notificationId = payload.notification_id ?? '';
      const target = resolvePushTarget(payload.action_link);

      invalidateInbox();
      showForegroundNotification(
        payload.title || tRef.current('notification.title'),
        payload.body || '',
        target || DEFAULT_PUSH_TARGET,
        notificationId
      );
    };

    const handleNotificationActionPerformed = ({
      notification,
    }: NotificationActionPerformedEvent) => {
      const payload = readPayload(notification);
      const notificationId = payload.notification_id ?? '';

      if (!acceptTapRef.current(notification?.id ?? notificationId)) return;

      if (notificationId) {
        void markNotificationAsRead(notificationId, true).catch(
          () => undefined
        );
      }
      invalidateInbox();

      navigateRef.current(
        resolvePushTarget(payload.action_link) || DEFAULT_PUSH_TARGET
      );
    };

    void (async () => {
      const ready = await initializeNativePush();
      if (!ready || cancelled) return;

      await Promise.all([
        FirebaseMessaging.addListener('tokenReceived', handleTokenReceived),
        FirebaseMessaging.addListener(
          'notificationReceived',
          handleNotificationReceived
        ),
        FirebaseMessaging.addListener(
          'notificationActionPerformed',
          handleNotificationActionPerformed
        ),
      ]);
      bound = true;
    })();

    return () => {
      cancelled = true;
      clearRegistrationRetry();
      if (!bound) return;

      void Promise.all([
        FirebaseMessaging.removeAllListeners(),
      ]).catch((cleanupError) => {
        console.warn('[fcm] listener cleanup failed:', cleanupError);
      });
    };
  }, [available, clearRegistrationRetry, invalidateInbox]);

  // Token lifecycle. It waits for `authLoading` to clear so the initial session
  // restoration is never mistaken for a sign-out, and re-registers on every
  // account change so a shared phone never keeps the previous account's address.
  useEffect(() => {
    if (!available || authLoading) return;

    let cancelled = false;

    void (async () => {
      const ready = await initializeNativePush();
      if (!ready || cancelled) return;

      if (!userId) {
        clearRegistrationRetry();
        syncedTokenRef.current = null;
        setRegistered(false);
        await refreshPermission();
        return;
      }

      const permission = await refreshPermission();
      if (cancelled) return;

      if (permission === 'granted') {
        syncedTokenRef.current = null;
        await syncRegistration();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    available,
    authLoading,
    clearRegistrationRetry,
    refreshPermission,
    syncRegistration,
    userId,
  ]);

  // Returning from Android settings, or a token issued while the app was in the
  // background, must both be reflected without a restart.
  useEffect(() => {
    if (!available) return;

    let cancelled = false;
    let handle: PluginListenerHandle | null = null;

    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) return;
      void (async () => {
        const permission = await refreshPermission();
        if (permission === 'granted' && userIdRef.current) {
          await syncRegistration();
        }
      })();
    }).then((registeredHandle) => {
      if (cancelled) {
        void registeredHandle.remove();
        return;
      }
      handle = registeredHandle;
    });

    return () => {
      cancelled = true;
      if (handle) void handle.remove();
    };
  }, [available, refreshPermission, syncRegistration]);

  const enable = useCallback(async () => {
    if (!available) return;

    setBusy(true);
    setError(null);
    setDeviceNotificationsDisabled(false);

    try {
      const next = canRequestNativePermission(status)
        ? await requestNativePushPermission()
        : await checkNativePushPermission();

      setStatus(next);

      if (next !== 'granted') {
        setRegistered(false);
        if (next === 'unsupported') {
          setError(t('notification.deviceError'));
        }
        return;
      }

      syncedTokenRef.current = null;
      await syncRegistration();
    } catch (enableError) {
      setError(messageOf(enableError, 'could not enable notifications'));
    } finally {
      setBusy(false);
    }
  }, [available, status, syncRegistration, t]);

  const disable = useCallback(async () => {
    if (!available) return;

    setBusy(true);
    setError(null);

    try {
      // Deactivate first: the session is still valid, so the API can clear this
      // installation before the token is destroyed.
      try {
        await deactivateNativePushDevice();
      } catch (deactivateError) {
        console.warn('[fcm] device deactivation failed:', deactivateError);
      }

      await clearNativePushToken();
      clearRegistrationRetry();
      syncedTokenRef.current = null;
      setDeviceNotificationsDisabled(true);
      setRegistered(false);
    } catch (disableError) {
      setError(messageOf(disableError, 'could not disable notifications'));
    } finally {
      setBusy(false);
    }
  }, [available, clearRegistrationRetry]);

  const openSettings = useCallback(async () => {
    const opened = await openNativeNotificationSettings();
    if (!opened) setError(t('notification.deviceSettingsUnavailable'));
  }, [t]);

  const value = useMemo<NativePushContextValue>(
    () => ({
      available,
      status,
      checking,
      busy,
      registered,
      error,
      enable,
      disable,
      openSettings,
    }),
    [
      available,
      status,
      checking,
      busy,
      registered,
      error,
      enable,
      disable,
      openSettings,
    ]
  );

  return (
    <NativePushContext.Provider value={value}>
      {children}
    </NativePushContext.Provider>
  );
};

export const useNativePush = (): NativePushContextValue => {
  const value = useContext(NativePushContext);
  if (!value) {
    throw new Error('useNativePush must be used within a NativePushProvider');
  }
  return value;
};
