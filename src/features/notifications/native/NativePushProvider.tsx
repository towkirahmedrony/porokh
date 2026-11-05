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
import OneSignal, {
  type NotificationClickEvent,
  type NotificationWillDisplayEvent,
  type PushSubscriptionChangedState,
} from '@onesignal/capacitor-plugin';
import toast from 'react-hot-toast';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { STORAGE_KEYS } from '@/shared/constants/storageKeys';
import { StorageUtils } from '@/shared/utils/storage';
import { markNotificationAsRead } from '../services/notificationService';
import {
  checkNativePushPermission,
  deactivateNativePushDevice,
  getNativePushExternalId,
  getOneSignalInitState,
  initializeNativePush,
  isNativePushAvailable,
  isNativePushSupported,
  linkNativePushToUser,
  openNativeNotificationSettings,
  optInNativePush,
  optOutNativePush,
  readNativePushSubscription,
  requestNativePushPermission,
  syncNativePushDevice,
  unlinkNativePushFromUser,
} from './nativePush';
import {
  buildPushDiagnostics,
  canRequestNativePermission,
  formatPushDiagnostics,
  isNativePushRegistered,
  shouldAskOnFirstLaunch,
  type NativePushStatus,
  type PushSubscriptionSnapshot,
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

const readPayload = (notification: { additionalData?: object } | null | undefined) =>
  (notification?.additionalData ?? {}) as Record<string, unknown>;

/**
 * An in-app disable is a user decision, not a transient state: it must survive
 * a restart and must not be undone by the resume or login effects.
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
 * Owns the OneSignal lifecycle for the whole app:
 *
 * - External ID = the signed-in Supabase user, so an account switch re-targets
 *   the device and a sign-out detaches it
 * - foreground delivery → in-app toast (the tray is Android's job)
 * - taps → React Router, exactly once per notification id
 *
 * It asks once on first launch without blocking startup, then leaves every
 * later decision to the Settings card. A denial or an in-app disable is never
 * silently retried.
 */
export const NativePushProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const available = isNativePushAvailable();
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
   * The subscription id and FCM token can arrive after the permission dialog
   * closes. A short, single retry covers that window without polling forever;
   * later subscription events still trigger their own verification.
   */
  const scheduleRegistrationRetry = useCallback(() => {
    if (retryTimerRef.current !== null) return;

    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null;
      void (async () => {
        const snapshot = await readNativePushSubscription();
        if (!mountedRef.current) return;
        setRegistered(isNativePushRegistered(snapshot));
      })();
    }, 2000);
  }, []);

  const refreshPermission = useCallback(async (): Promise<NativePushStatus> => {
    if (!available) {
      setChecking(false);
      return 'unsupported';
    }

    const next = await checkNativePushPermission();
    const snapshot = await readNativePushSubscription();

    setStatus(next);
    setRegistered(isNativePushRegistered(snapshot));
    setChecking(false);

    if (import.meta.env.DEV) {
      const externalId = await getNativePushExternalId();
      console.info(
        formatPushDiagnostics(
          buildPushDiagnostics({
            initState: getOneSignalInitState(),
            externalId,
            userId: userIdRef.current,
            subscriptionId: snapshot?.subscriptionId ?? null,
            hasPushToken: snapshot?.hasPushToken === true,
            optedIn: snapshot?.optedIn === true,
            permissionGranted: next === 'granted',
          })
        )
      );
    }

    return next;
  }, [available]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearRegistrationRetry();
    };
  }, [clearRegistrationRetry]);

  // A native build without VITE_ONESIGNAL_APP_ID is not a web build: push is
  // silently unavailable. Say so once instead of leaving a mystery on device.
  useEffect(() => {
    if (!isNativePushSupported()) return;
    if (getOneSignalInitState() === 'missing_app_id') {
      console.warn(
        '[onesignal] VITE_ONESIGNAL_APP_ID is not configured in this build; push is disabled.'
      );
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
  // language change never re-binds them. Initialisation runs first because
  // OneSignal replays a tap that launched the app once the SDK is ready.
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

    const handleClick = (event: NotificationClickEvent) => {
      const notification = event?.notification;
      if (!acceptTapRef.current(notification?.notificationId)) return;

      const payload = readPayload(notification);
      const notificationId =
        typeof payload.notification_id === 'string'
          ? payload.notification_id
          : '';

      if (notificationId) {
        void markNotificationAsRead(notificationId, true).catch(
          () => undefined
        );
      }
      invalidateInbox();

      const target = resolvePushTarget(payload.action_link);
      navigateRef.current(target || DEFAULT_PUSH_TARGET);
    };

    const handleForeground = (event: NotificationWillDisplayEvent) => {
      const notification = event.getNotification();
      const payload = readPayload(notification);
      const notificationId =
        typeof payload.notification_id === 'string'
          ? payload.notification_id
          : '';

      invalidateInbox();
      showForegroundNotification(
        notification?.title || tRef.current('notification.title'),
        notification?.body || '',
        resolvePushTarget(payload.action_link),
        notificationId
      );
    };

    const handlePermissionChange = () => {
      void refreshPermission();
    };

    const handleSubscriptionChange = (state: PushSubscriptionChangedState) => {
      const snapshot: PushSubscriptionSnapshot = {
        subscriptionId: state.current?.id
          ? String(state.current.id)
          : null,
        hasPushToken: Boolean(String(state.current?.token ?? '').trim()),
        optedIn: state.current?.optedIn === true,
      };
      const nextRegistered = isNativePushRegistered(snapshot);

      setRegistered(nextRegistered);
      if (!nextRegistered && snapshot.optedIn) scheduleRegistrationRetry();
    };

    void (async () => {
      const ready = await initializeNativePush();
      if (!ready || cancelled) return;

      OneSignal.Notifications.addEventListener('click', handleClick);
      OneSignal.Notifications.addEventListener(
        'foregroundWillDisplay',
        handleForeground
      );
      OneSignal.Notifications.addEventListener(
        'permissionChange',
        handlePermissionChange
      );
      OneSignal.User.pushSubscription.addEventListener(
        'change',
        handleSubscriptionChange
      );
      bound = true;
    })();

    return () => {
      cancelled = true;
      clearRegistrationRetry();
      if (!bound) return;

      try {
        OneSignal.Notifications.removeEventListener('click', handleClick);
        OneSignal.Notifications.removeEventListener(
          'foregroundWillDisplay',
          handleForeground
        );
        OneSignal.Notifications.removeEventListener(
          'permissionChange',
          handlePermissionChange
        );
        OneSignal.User.pushSubscription.removeEventListener(
          'change',
          handleSubscriptionChange
        );
      } catch (error) {
        console.warn('[onesignal] listener cleanup failed:', error);
      }
    };
  }, [
    available,
    clearRegistrationRetry,
    invalidateInbox,
    refreshPermission,
    scheduleRegistrationRetry,
  ]);

  // External ID lifecycle. It waits for `authLoading` to clear so the initial
  // session restoration is never mistaken for a sign-out.
  useEffect(() => {
    if (!available || authLoading) return;

    let cancelled = false;

    void (async () => {
      const ready = await initializeNativePush();
      if (!ready || cancelled) return;

      if (userId) {
        await linkNativePushToUser(userId);
        if (cancelled) return;

        await refreshPermission();
        return;
      }

      clearRegistrationRetry();
      setRegistered(false);
      await unlinkNativePushFromUser();
    })();

    return () => {
      cancelled = true;
    };
  }, [available, authLoading, clearRegistrationRetry, refreshPermission, userId]);

  // Record the installation only once OneSignal has a subscription id and a
  // push token. This keeps `user_devices` an audience of reachable devices and
  // still stores no token now that delivery is addressed by Supabase UUID.
  useEffect(() => {
    if (!available || authLoading || !userId || !registered) return;
    if (isDeviceNotificationsDisabled()) return;

    let cancelled = false;

    void (async () => {
      try {
        await syncNativePushDevice();
        if (!cancelled) setError(null);
      } catch (syncError) {
        if (!cancelled) {
          setError(messageOf(syncError, 'device registration failed'));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [available, authLoading, registered, userId]);

  // Returning from Android settings must reflect the new permission state.
  useEffect(() => {
    if (!available) return;

    let cancelled = false;
    let handle: PluginListenerHandle | null = null;

    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) return;
      void refreshPermission();
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
  }, [available, refreshPermission]);

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

      await optInNativePush();

      const currentUserId = userIdRef.current;
      if (currentUserId) await linkNativePushToUser(currentUserId);

      const snapshot = await readNativePushSubscription();
      const nextRegistered = isNativePushRegistered(snapshot);
      setRegistered(nextRegistered);
      if (!nextRegistered) scheduleRegistrationRetry();
    } catch (enableError) {
      setError(messageOf(enableError, 'could not enable notifications'));
    } finally {
      setBusy(false);
    }
  }, [available, scheduleRegistrationRetry, status, t]);

  const disable = useCallback(async () => {
    if (!available) return;

    setBusy(true);
    setError(null);

    try {
      // Deactivate first: the session is still valid, so the API can clear this
      // installation before the device stops receiving pushes.
      try {
        await deactivateNativePushDevice();
      } catch (deactivateError) {
        console.warn('[onesignal] device deactivation failed:', deactivateError);
      }

      await optOutNativePush();
      clearRegistrationRetry();
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
