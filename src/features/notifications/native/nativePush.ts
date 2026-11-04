import { Capacitor, registerPlugin } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { apiClient } from '@/shared/lib/apiClient';
import { getDeviceId } from '@/shared/utils/device';
import {
  toNativePushStatus,
  type NativePushStatus,
} from './pushPermission';

/**
 * Native push bridge.
 *
 * Every entry point is guarded by `isNativePushAvailable()`: an APK built
 * before this plugin existed (1.0.2 and older) still receives OTA bundles, and
 * those bundles must keep working instead of throwing on a missing plugin.
 */

/** Must match `PUSH_CHANNEL_ID` in the backend and AndroidManifest. */
export const NATIVE_PUSH_CHANNEL_ID = 'porokh_default';

const ANDROID_IMPORTANCE_HIGH = 4;
const ANDROID_VISIBILITY_PUBLIC = 1;

interface NotificationSettingsPlugin {
  openAppNotificationSettings(): Promise<void>;
}

const AppNotificationSettings =
  registerPlugin<NotificationSettingsPlugin>('NotificationSettings');

const getNativeDeviceLabel = (): string => {
  const match = /Android\s+([\d.]+)/i.exec(navigator.userAgent);
  return match ? `Android ${match[1]}` : 'Android app';
};

export const isNativePushAvailable = (): boolean =>
  Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('PushNotifications');

export const checkNativePushPermission = async (): Promise<NativePushStatus> => {
  if (!isNativePushAvailable()) return 'unsupported';

  try {
    const status = await PushNotifications.checkPermissions();
    return toNativePushStatus(status.receive);
  } catch (error) {
    console.warn('[native-push] permission check failed:', error);
    return 'unsupported';
  }
};

export const requestNativePushPermission = async (): Promise<NativePushStatus> => {
  if (!isNativePushAvailable()) return 'unsupported';

  const status = await PushNotifications.requestPermissions();
  return toNativePushStatus(status.receive);
};

/**
 * The channel must exist before the first message arrives, otherwise Android
 * silently falls back to the Firebase default channel.
 */
export const ensureNativePushChannel = async (): Promise<void> => {
  if (!isNativePushAvailable()) return;

  try {
    await PushNotifications.createChannel({
      id: NATIVE_PUSH_CHANNEL_ID,
      name: 'Porokh updates',
      description: 'Exam reminders, results, streak and account updates',
      importance: ANDROID_IMPORTANCE_HIGH,
      visibility: ANDROID_VISIBILITY_PUBLIC,
      vibration: true,
    });
  } catch (error) {
    // A channel can only be created on Android 8+; an older device is fine.
    console.warn('[native-push] channel setup skipped:', error);
  }
};

export const registerNativePush = async (): Promise<void> => {
  if (!isNativePushAvailable()) return;

  await ensureNativePushChannel();
  await PushNotifications.register();
};

export const unregisterNativePush = async (): Promise<void> => {
  if (!isNativePushAvailable()) return;
  await PushNotifications.unregister();
};

/**
 * Attaches the FCM token to the signed-in Supabase user through the existing
 * device endpoint (the same one Web Push uses). The platform field tells the
 * backend which payload shape this installation needs.
 */
export const syncNativePushToken = async (token: string): Promise<void> => {
  const value = String(token ?? '').trim();
  if (!value) throw new Error('Empty FCM token');

  await apiClient.post('/notifications/device-token', {
    device_id: getDeviceId(),
    device_name: getNativeDeviceLabel(),
    os_or_browser: navigator.userAgent,
    fcm_token: value,
    platform: 'android',
  });
};

/** Deactivates this installation's token without deleting its history. */
export const deactivateNativePushToken = async (): Promise<void> => {
  await apiClient.delete('/notifications/device-token', {
    data: { device_id: getDeviceId() },
  });
};

/**
 * Runs on sign-out, before the Supabase session is cleared. Best effort: a
 * failed cleanup must never stop the user from signing out.
 */
export const unregisterNativePushOnSignOut = async (): Promise<void> => {
  if (!isNativePushAvailable()) return;

  try {
    await deactivateNativePushToken();
  } catch (error) {
    console.warn('[native-push] device deactivation failed:', error);
  }

  try {
    await unregisterNativePush();
  } catch (error) {
    console.warn('[native-push] FCM unregister failed:', error);
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
    console.warn('[native-push] opening notification settings failed:', error);
    return false;
  }
};
