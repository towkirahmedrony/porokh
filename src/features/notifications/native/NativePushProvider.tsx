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
import {
  PushNotifications,
  type ActionPerformed,
  type PushNotificationSchema,
} from '@capacitor/push-notifications';
import toast from 'react-hot-toast';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { STORAGE_KEYS } from '@/shared/constants/storageKeys';
import { StorageUtils } from '@/shared/utils/storage';
import {
  checkNativePushPermission,
  deactivateNativePushToken,
  isNativePushAvailable,
  openNativeNotificationSettings,
  registerNativePush,
  requestNativePushPermission,
  syncNativePushToken,
  unregisterNativePush,
} from './nativePush';
import {
  canRequestNativePermission,
  shouldRegisterNativePush,
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
 * An in-app disable is a user decision, not a transient state: it must survive
 * a restart and must not be undone by the resume/registration effect.
 */
const isDeviceNotificationsDisabled = (): boolean =>
  StorageUtils.get<boolean>(STORAGE_KEYS.NATIVE_PUSH_DISABLED) === true;

const setDeviceNotificationsDisabled = (disabled: boolean): void => {
  StorageUtils.set(STORAGE_KEYS.NATIVE_PUSH_DISABLED, disabled);
};

/**
 * Owns the native push lifecycle for the whole app:
 *
 * - registration / token refresh → existing `/notifications/device-token`
 * - foreground delivery → in-app toast (the tray is owned by Android)
 * - taps → React Router, exactly once per message id
 *
 * It never requests permission on its own. Permission is requested from the
 * Settings card (or a deliberate action), so a fresh install is not greeted by
 * a system dialog before the user knows what it is for.
 */
export const NativePushProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const available = isNativePushAvailable();
  const navigate = useNavigate();
  const { user } = useAuth();
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

  const syncToken = useCallback(async (token: string) => {
    try {
      await syncNativePushToken(token);
      setRegistered(true);
      setError(null);
    } catch (syncError) {
      setError(messageOf(syncError, 'token sync failed'));
    }
  }, []);

  const registerWhenReady = useCallback(
    async (nextStatus: NativePushStatus, nextUserId: string | null) => {
      if (!shouldRegisterNativePush(nextStatus, nextUserId)) return;

      try {
        await registerNativePush();
      } catch (registerError) {
        setError(messageOf(registerError, 'registration failed'));
      }
    },
    []
  );

  // Initial permission read and silent (re)registration for users who already
  // granted it. Runs again per user so an account switch re-attaches the token.
  useEffect(() => {
    if (!available) return;

    let cancelled = false;

    void (async () => {
      const next = await checkNativePushPermission();
      if (cancelled) return;

      setStatus(next);
      setChecking(false);

      if (!isDeviceNotificationsDisabled()) {
        await registerWhenReady(next, userId);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [available, registerWhenReady, userId]);

  // Native listeners live for the app lifetime; handlers read refs so a
  // navigation never re-binds them.
  useEffect(() => {
    if (!available) return;

    let cancelled = false;
    const handles: PluginListenerHandle[] = [];

    const keep = (handle: PluginListenerHandle) => {
      if (cancelled) {
        void handle.remove();
        return;
      }
      handles.push(handle);
    };

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

    void (async () => {
      keep(
        await PushNotifications.addListener('registration', ({ value }) => {
          void syncToken(value);
        })
      );

      keep(
        await PushNotifications.addListener('registrationError', ({ error: message }) => {
          setError(message || 'registration failed');
        })
      );

      keep(
        await PushNotifications.addListener(
          'pushNotificationReceived',
          (notification: PushNotificationSchema) => {
            const title = notification.title || tRef.current('notification.title');
            const body = notification.body || '';
            const target = resolvePushTarget(notification.data?.action_link);
            showForegroundNotification(title, body, target);
          }
        )
      );

      keep(
        await PushNotifications.addListener(
          'pushNotificationActionPerformed',
          (action: ActionPerformed) => {
            const notification = action.notification;
            if (!acceptTapRef.current(notification?.id)) return;

            const target = resolvePushTarget(notification?.data?.action_link);
            navigateRef.current(target || DEFAULT_PUSH_TARGET);
          }
        )
      );
    })();

    return () => {
      cancelled = true;
      handles.forEach((handle) => {
        void handle.remove();
      });
    };
  }, [available, syncToken]);

  // Returning from Android settings must reflect the new permission state.
  useEffect(() => {
    if (!available) return;

    let cancelled = false;
    let handle: PluginListenerHandle | null = null;

    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) return;

      void (async () => {
        const next = await checkNativePushPermission();
        if (cancelled) return;

        setStatus(next);

        if (!isDeviceNotificationsDisabled()) {
          await registerWhenReady(next, userIdRef.current);
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
  }, [available, registerWhenReady]);

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

      if (next === 'granted') {
        await registerNativePush();
      }
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
      // Deactivate first: the session is still valid, so the API can clear the
      // token before the local FCM registration is dropped.
      await deactivateNativePushToken();
      await unregisterNativePush();
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
