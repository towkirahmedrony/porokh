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
import {
  checkNativePushPermission,
  deactivateNativePushDevice,
  initializeNativePush,
  isNativePushAvailable,
  isNativePushOptedIn,
  linkNativePushToUser,
  openNativeNotificationSettings,
  optInNativePush,
  optOutNativePush,
  requestNativePushPermission,
  syncNativePushDevice,
  unlinkNativePushFromUser,
} from './nativePush';
import {
  canRequestNativePermission,
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

/**
 * Owns the OneSignal lifecycle for the whole app:
 *
 * - External ID = the signed-in Supabase user, so an account switch re-targets
 *   the device and a sign-out detaches it
 * - foreground delivery → in-app toast (the tray is Android's job)
 * - taps → React Router, exactly once per notification id
 *
 * It never requests permission on its own. Permission is requested from the
 * Settings card, so a fresh install is not greeted by a system dialog before
 * the user knows what it is for.
 */
export const NativePushProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const available = isNativePushAvailable();
  const navigate = useNavigate();
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

  navigateRef.current = navigate;
  tRef.current = t;
  userIdRef.current = userId;

  const refreshPermission = useCallback(async (): Promise<NativePushStatus> => {
    if (!available) {
      setChecking(false);
      return 'unsupported';
    }

    const next = await checkNativePushPermission();
    const optedIn = await isNativePushOptedIn();

    setStatus(next);
    setRegistered(next === 'granted' && optedIn);
    setChecking(false);
    return next;
  }, [available]);

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
      target: string
    ) => {
      toast.custom(
        (instance) => (
          <div
            onClick={() => {
              toast.dismiss(instance.id);
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

      const target = resolvePushTarget(readPayload(notification).action_link);
      navigateRef.current(target || DEFAULT_PUSH_TARGET);
    };

    const handleForeground = (event: NotificationWillDisplayEvent) => {
      const notification = event.getNotification();
      showForegroundNotification(
        notification?.title || tRef.current('notification.title'),
        notification?.body || '',
        resolvePushTarget(readPayload(notification).action_link)
      );
    };

    const handlePermissionChange = () => {
      void refreshPermission();
    };

    const handleSubscriptionChange = (state: PushSubscriptionChangedState) => {
      setRegistered(state.current?.optedIn === true);
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
  }, [available, refreshPermission]);

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

        const next = await refreshPermission();
        if (cancelled || next !== 'granted') return;
        if (isDeviceNotificationsDisabled()) return;

        try {
          await syncNativePushDevice();
          setError(null);
        } catch (syncError) {
          setError(messageOf(syncError, 'device registration failed'));
        }
        return;
      }

      await unlinkNativePushFromUser();
    })();

    return () => {
      cancelled = true;
    };
  }, [available, authLoading, refreshPermission, userId]);

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
        return;
      }

      await optInNativePush();

      const currentUserId = userIdRef.current;
      if (currentUserId) await linkNativePushToUser(currentUserId);

      try {
        await syncNativePushDevice();
      } catch (syncError) {
        setError(messageOf(syncError, 'device registration failed'));
      }

      setRegistered(true);
    } catch (enableError) {
      setError(messageOf(enableError, 'could not enable notifications'));
    } finally {
      setBusy(false);
    }
  }, [available, status]);

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
      setDeviceNotificationsDisabled(true);
      setRegistered(false);
    } catch (disableError) {
      setError(messageOf(disableError, 'could not disable notifications'));
    } finally {
      setBusy(false);
    }
  }, [available]);

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
