import { Capacitor, registerPlugin } from '@capacitor/core';
import OneSignal from '@onesignal/capacitor-plugin';
import { apiClient } from '@/shared/lib/apiClient';
import { getDeviceId } from '@/shared/utils/device';
import {
  toNativePushStatus,
  type NativePushStatus,
  type OneSignalInitState,
  type PushSubscriptionSnapshot,
} from './pushPermission';

/**
 * OneSignal bridge for the Android shell.
 *
 * OneSignal only delivers the push. The notification record itself lives in
 * Supabase and is authorised through RLS, so the payload never carries private
 * content and the tap handler only routes to an existing screen.
 *
 * The Capacitor plugin has no web implementation, so every entry point is
 * guarded: the website keeps working with no push transport at all.
 */

/** Public app id, safe to ship inside the bundle. The REST key stays server-side. */
export const ONESIGNAL_APP_ID = String(
  import.meta.env.VITE_ONESIGNAL_APP_ID ?? ''
).trim();

interface NotificationSettingsPlugin {
  openAppNotificationSettings(): Promise<void>;
}

const AppNotificationSettings =
  registerPlugin<NotificationSettingsPlugin>('NotificationSettings');

/** Native shell with the plugin linked, regardless of build-time config. */
export const isNativePushSupported = (): boolean =>
  Capacitor.isNativePlatform() &&
  Capacitor.isPluginAvailable('OneSignalCapacitor');

/** Usable push transport: native shell, plugin and a bundled app id. */
export const isNativePushAvailable = (): boolean =>
  isNativePushSupported() && Boolean(ONESIGNAL_APP_ID);

const getNativeDeviceLabel = (): string => {
  const match = /Android\s+([\d.]+)/i.exec(navigator.userAgent);
  return match ? `Android ${match[1]}` : 'Android app';
};

const initialInitState = (): OneSignalInitState => {
  if (!isNativePushSupported()) return 'sdk_unavailable';
  return ONESIGNAL_APP_ID ? 'pending' : 'missing_app_id';
};

let initState: OneSignalInitState = initialInitState();

/** Exposed for diagnostics, never for routing decisions. */
export const getOneSignalInitState = (): OneSignalInitState => initState;

/**
 * Initialisation runs exactly once per page load: a second call reuses the
 * in-flight promise, so React StrictMode or a remount cannot double-initialise
 * the native SDK or replay a pending notification twice.
 */
let initialization: Promise<boolean> | null = null;

export const initializeNativePush = (): Promise<boolean> => {
  if (!isNativePushAvailable()) {
    initState = initialInitState();
    return Promise.resolve(false);
  }

  if (!initialization) {
    initState = 'pending';
    initialization = OneSignal.initialize(ONESIGNAL_APP_ID)
      .then(() => {
        initState = 'initialized';
        return true;
      })
      .catch((error) => {
        initState = 'failed';
        console.warn('[onesignal] initialization failed:', error);
        // A later attempt (next app start) may succeed, so the cache is cleared.
        initialization = null;
        return false;
      });
  }

  return initialization;
};

export const checkNativePushPermission = async (): Promise<NativePushStatus> => {
  if (!isNativePushAvailable()) return 'unsupported';
  if (!(await initializeNativePush())) return 'unsupported';

  try {
    const [granted, canAsk] = await Promise.all([
      OneSignal.Notifications.hasPermission(),
      OneSignal.Notifications.canRequestPermission(),
    ]);

    return toNativePushStatus({ granted, canAsk });
  } catch (error) {
    console.warn('[onesignal] permission check failed:', error);
    return 'unsupported';
  }
};

/**
 * `false` for the settings fallback: after Android records a denial the app
 * cannot re-prompt, and the card points at the system screen instead of
 * bouncing the user into Settings without context.
 */
export const requestNativePushPermission = async (): Promise<NativePushStatus> => {
  if (!isNativePushAvailable()) return 'unsupported';
  if (!(await initializeNativePush())) return 'unsupported';

  try {
    await OneSignal.Notifications.requestPermission(false);
  } catch (error) {
    console.warn('[onesignal] permission request failed:', error);
  }

  return checkNativePushPermission();
};

/**
 * The three values that prove OneSignal can actually reach this installation.
 * A permission grant alone is not enough: the subscription id and FCM token can
 * arrive seconds later, and the token may never arrive if Firebase is broken.
 */
export const readNativePushSubscription =
  async (): Promise<PushSubscriptionSnapshot | null> => {
    if (!isNativePushAvailable()) return null;
    if (!(await initializeNativePush())) return null;

    try {
      const [subscriptionId, pushToken, optedIn] = await Promise.all([
        OneSignal.User.pushSubscription.getIdAsync(),
        OneSignal.User.pushSubscription.getTokenAsync(),
        OneSignal.User.pushSubscription.getOptedInAsync(),
      ]);

      return {
        subscriptionId: subscriptionId ? String(subscriptionId) : null,
        hasPushToken: Boolean(String(pushToken ?? '').trim()),
        optedIn: optedIn === true,
      };
    } catch (error) {
      console.warn('[onesignal] subscription state unavailable:', error);
      return null;
    }
  };

export const getNativePushExternalId = async (): Promise<string | null> => {
  if (!isNativePushAvailable()) return null;

  try {
    const externalId = await OneSignal.User.getExternalId();
    return externalId ? String(externalId) : null;
  } catch (error) {
    console.warn('[onesignal] external id unavailable:', error);
    return null;
  }
};

export const optInNativePush = async (): Promise<void> => {
  if (!isNativePushAvailable()) return;
  await OneSignal.User.pushSubscription.optIn();
};

export const optOutNativePush = async (): Promise<void> => {
  if (!isNativePushAvailable()) return;
  await OneSignal.User.pushSubscription.optOut();
};

/**
 * Records this installation in Supabase. It stores no push token any more:
 * OneSignal targets the Supabase user UUID, so the row exists for device
 * history and the "new device login" security notification.
 */
export const syncNativePushDevice = async (): Promise<void> => {
  await apiClient.post('/notifications/device-token', {
    device_id: getDeviceId(),
    device_name: getNativeDeviceLabel(),
    os_or_browser: navigator.userAgent,
    platform: 'android',
  });
};

export const deactivateNativePushDevice = async (): Promise<void> => {
  await apiClient.delete('/notifications/device-token', {
    data: { device_id: getDeviceId() },
  });
};

/**
 * Identity calls are serialised. Two effects can race during an account switch
 * (login for the new user, logout for the old one); without a queue the last
 * network answer would win instead of the last requested state.
 */
let identityQueue: Promise<void> = Promise.resolve();

const runIdentityTask = (task: () => Promise<void>): Promise<void> => {
  const run = identityQueue.then(task);
  identityQueue = run.catch(() => undefined);
  return run;
};

/**
 * Associates this device with the signed-in Supabase user. The external id is
 * always the session's UUID, never a value from storage or a deep link, so a
 * device can only ever receive the pushes of the account that is signed in.
 */
export const linkNativePushToUser = async (userId: string): Promise<void> => {
  const externalId = String(userId ?? '').trim();
  if (!externalId || !isNativePushAvailable()) return;
  if (!(await initializeNativePush())) return;

  await runIdentityTask(async () => {
    const current = await getNativePushExternalId();
    if (current === externalId) return;
    await OneSignal.login(externalId);
  });
};

/**
 * Detaches the device from the previous account. OneSignal keeps the
 * subscription under a fresh anonymous user, so the signed-out phone stops
 * receiving the old account's pushes without losing its permission.
 */
export const unlinkNativePushFromUser = async (): Promise<void> => {
  if (!isNativePushAvailable()) return;

  await runIdentityTask(async () => {
    const current = await getNativePushExternalId();
    if (!current) return;
    await OneSignal.logout();
  });
};

/**
 * Runs on sign-out, before the Supabase session is cleared. Best effort: a
 * failed cleanup must never stop the user from signing out.
 */
export const unregisterNativePushOnSignOut = async (): Promise<void> => {
  if (!isNativePushAvailable()) return;

  try {
    await deactivateNativePushDevice();
  } catch (error) {
    console.warn('[onesignal] device deactivation failed:', error);
  }

  try {
    await unlinkNativePushFromUser();
  } catch (error) {
    console.warn('[onesignal] logout failed:', error);
  }
};

/**
 * Opens this app's Android notification settings. Returns false when the
 * installed APK predates the small native plugin that provides the intent.
 */
export const openNativeNotificationSettings = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;
  if (!Capacitor.isPluginAvailable('NotificationSettings')) return false;

  try {
    await AppNotificationSettings.openAppNotificationSettings();
    return true;
  } catch (error) {
    console.warn('[onesignal] opening notification settings failed:', error);
    return false;
  }
};
