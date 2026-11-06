import { Capacitor, registerPlugin } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { apiClient } from '@/shared/lib/apiClient';
import { getDeviceId } from '@/shared/utils/device';
import {
  toNativePushStatus,
  type FcmInitState,
  type NativePushStatus,
} from './pushPermission';

/**
 * Firebase Cloud Messaging bridge for the Android shell.
 *
 * FCM delivers the push. The notification record itself lives in Supabase and is
 * authorised through RLS, so the payload only carries a route and identifiers,
 * and the tap handler only opens an existing screen.
 *
 * The plugin has no web implementation, so every entry point is guarded: the
 * website keeps working with no native push transport at all.
 */

interface NotificationSettingsPlugin {
  openAppNotificationSettings(): Promise<void>;
}

const AppNotificationSettings =
  registerPlugin<NotificationSettingsPlugin>('NotificationSettings');

/** Native shell with the FCM plugin linked. */
export const isNativePushSupported = (): boolean =>
  Capacitor.isNativePlatform() &&
  Capacitor.isPluginAvailable('FirebaseMessaging');

let initState: FcmInitState = isNativePushSupported()
  ? 'pending'
  : 'plugin_unavailable';

/** Exposed for diagnostics, never for routing decisions. */
export const getFcmInitState = (): FcmInitState => initState;

/**
 * Runs once per page load: a second call reuses the in-flight promise, so React
 * StrictMode or a remount cannot initialise the native SDK twice.
 */
let initialization: Promise<boolean> | null = null;

export const initializeNativePush = (): Promise<boolean> => {
  if (!isNativePushSupported()) {
    initState = 'plugin_unavailable';
    return Promise.resolve(false);
  }

  if (!initialization) {
    initState = 'pending';
    initialization = FirebaseMessaging.isSupported()
      .then(({ isSupported }) => {
        if (!isSupported) {
          initState = 'plugin_unavailable';
          return false;
        }
        initState = 'initialized';
        return true;
      })
      .catch((error) => {
        initState = 'failed';
        console.warn('[fcm] initialization failed:', error);
        // A later attempt (next app start) may succeed, so the cache is cleared.
        initialization = null;
        return false;
      });
  }

  return initialization;
};

export const checkNativePushPermission = async (): Promise<NativePushStatus> => {
  if (!(await initializeNativePush())) return 'unsupported';

  try {
    const status = await FirebaseMessaging.checkPermissions();
    return toNativePushStatus({ receive: status.receive });
  } catch (error) {
    console.warn('[fcm] permission check failed:', error);
    return 'unsupported';
  }
};

/**
 * Asks for the runtime permission. The plugin reports what Android recorded, so
 * a denial is visible immediately instead of being assumed from the request.
 */
export const requestNativePushPermission = async (): Promise<NativePushStatus> => {
  if (!(await initializeNativePush())) return 'unsupported';

  try {
    const status = await FirebaseMessaging.requestPermissions();
    return toNativePushStatus({ receive: status.receive });
  } catch (error) {
    console.warn('[fcm] permission request failed:', error);
    return 'unsupported';
  }
};

/**
 * The FCM registration token for this installation, or null while it is still
 * being issued. The token is a credential: it is only ever sent to our own
 * backend and never logged.
 */
export const readNativePushToken = async (): Promise<string | null> => {
  if (!(await initializeNativePush())) return null;

  try {
    const { token } = await FirebaseMessaging.getToken();
    return String(token ?? '').trim() || null;
  } catch (error) {
    console.warn('[fcm] token unavailable:', error);
    return null;
  }
};

const getAndroidDeviceLabel = (): string => {
  const match = /Android\s+([\d.]+)/i.exec(navigator.userAgent);
  return match ? `Android ${match[1]}` : 'Android app';
};

/**
 * Records this installation and its token. The backend binds the token to the
 * verified bearer token's user, so the client can never register for another
 * account.
 */
export const registerNativePushDevice = async (token: string): Promise<void> => {
  await apiClient.post('/notifications/device-token', {
    device_id: getDeviceId(),
    device_name: getAndroidDeviceLabel(),
    os_or_browser: navigator.userAgent,
    fcm_token: token,
    platform: 'android',
  });
};

/**
 * Clears this installation's token on sign-out, disable or account switch. The
 * device row survives so the security history and the login dedupe key stay.
 */
export const deactivateNativePushDevice = async (): Promise<void> => {
  await apiClient.delete('/notifications/device-token', {
    data: { device_id: getDeviceId() },
  });
};

/**
 * Invalidates the local token with Firebase. The next enabled session receives a
 * fresh one, which is what makes an in-app "disable" stick across restarts.
 */
export const clearNativePushToken = async (): Promise<void> => {
  if (!(await initializeNativePush())) return;

  try {
    await FirebaseMessaging.deleteToken();
  } catch (error) {
    console.warn('[fcm] token deletion failed:', error);
  }
};

/**
 * Runs on sign-out, before the Supabase session is cleared, so the API call is
 * still authenticated. Best effort: a failed cleanup must never stop the user
 * from signing out.
 */
export const unregisterNativePushOnSignOut = async (): Promise<void> => {
  if (!isNativePushSupported()) return;

  try {
    await deactivateNativePushDevice();
  } catch (error) {
    console.warn('[fcm] device deactivation failed:', error);
  }

  await clearNativePushToken();
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
    console.warn('[fcm] opening notification settings failed:', error);
    return false;
  }
};
