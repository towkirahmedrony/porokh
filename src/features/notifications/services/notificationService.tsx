import { Capacitor } from '@capacitor/core';
import { messaging } from '@/shared/lib/firebase';
import { getToken, onMessage, MessagePayload, Unsubscribe } from 'firebase/messaging';
import toast from 'react-hot-toast';
import { apiClient } from '@/shared/lib/apiClient';
import { StorageUtils } from '@/shared/utils/storage';
import { STORAGE_KEYS } from '@/shared/constants/storageKeys';
import { DBNotificationItem } from '../types/notificationTypes';

const VAPID_KEY =
  import.meta.env.VITE_FIREBASE_VAPID_KEY ||
  'BCXBVur7e0RozLaLRM9rX79GJeRQcRluggPQ4xqklnbvqDVFFuJrTI-XGKe4yF_qMYCvXyB-MIxlu26Dk9S-ryk';

export const getOrCreateDeviceId = (): string => {
  let deviceId = StorageUtils.get<string>(STORAGE_KEYS.DEVICE_ID);

  if (!deviceId) {
    deviceId = crypto.randomUUID();
    StorageUtils.set(STORAGE_KEYS.DEVICE_ID, deviceId);
  }

  return deviceId;
};

const getDeviceName = (): string => {
  const userAgent = navigator.userAgent;

  if (/Android/i.test(userAgent)) return 'Android Phone';
  if (/iPhone/i.test(userAgent)) return 'iPhone';
  if (/iPad/i.test(userAgent)) return 'iPad';
  if (/Mobile/i.test(userAgent)) return 'Mobile Device';

  return 'Web Client';
};

export const saveDeviceTokenToAPI = async (
  deviceId: string,
  token: string | null,
  platform: 'web' | 'android' = 'web'
): Promise<void> => {
  try {
    const userAgent = navigator.userAgent;

    const response = await apiClient.post('/notifications/device-token', {
      device_id: deviceId,
      device_name: getDeviceName(),
      os_or_browser: userAgent,
      fcm_token: token,
      platform,
    });

    console.log('[NotificationService] Device token synced:', response.data);
  } catch (error) {
    console.error('[NotificationService] Error syncing token with API:', error);
  }
};

export const requestNotificationPermission = async (): Promise<string | null> => {
  // Inside the Android shell the native plugin owns the token. Requesting a Web
  // Push token here would overwrite the native registration for the same
  // installation (both share one device id).
  if (Capacitor.isNativePlatform()) {
    return null;
  }

  if (!messaging) {
    console.warn('[NotificationService] Firebase messaging is not supported or initialized.');
    return null;
  }

  if (!('serviceWorker' in navigator)) {
    console.warn('[NotificationService] Service Worker is not supported in this browser.');
    return null;
  }

  if (!('Notification' in window)) {
    console.warn('[NotificationService] Notification API is not supported in this browser.');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      console.warn('[NotificationService] Notification permission denied by user.');
      return null;
    }

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      console.warn('[NotificationService] No FCM token returned.');
      return null;
    }

    const deviceId = getOrCreateDeviceId();
    await saveDeviceTokenToAPI(deviceId, token);

    return token;
  } catch (error) {
    console.error('[NotificationService] Error getting FCM token:', error);
    return null;
  }
};

export const listenForForegroundMessages = (): Unsubscribe | undefined => {
  if (!messaging) return undefined;

  return onMessage(messaging, (payload: MessagePayload) => {
    // The backend sends data-only messages (see notification.service.ts), so
    // `data` is authoritative and `notification` is only a fallback.
    const data = payload.data ?? {};
    const title = data.title || payload.notification?.title || 'New Update';
    const body = data.body || payload.notification?.body || '';
    const actionLink = data.action_link || '/';

    toast.custom((t) => (
      <div
        onClick={() => {
          if (!actionLink) return;
          if (actionLink.startsWith('http')) {
            window.open(actionLink, '_blank', 'noopener,noreferrer');
          } else {
            window.location.assign(actionLink);
          }
        }}
        className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full shadow-lg rounded-2xl pointer-events-auto flex border p-4 cursor-pointer`}
        style={{
          backgroundColor: 'var(--dyn-card)',
          borderColor: 'color-mix(in srgb, var(--dyn-text) 10%, transparent)',
        }}
      >
        <div className="flex-1 w-0">
          <div className="flex items-start">
            <div className="ml-3 flex-1 font-['Hind_Siliguri']">
              <p className="text-sm font-bold" style={{ color: 'var(--dyn-text)' }}>
                {title}
              </p>
              <p
                className="mt-1 text-sm"
                style={{
                  color: 'color-mix(in srgb, var(--dyn-text) 70%, transparent)',
                }}
              >
                {body}
              </p>
            </div>
          </div>
        </div>
      </div>
    ));
  });
};

// === API Functions (Typed & Hardened) ===

type NotificationApiResponse = DBNotificationItem[] | { data: DBNotificationItem[] };

export const fetchNotifications = async (): Promise<DBNotificationItem[]> => {
  try {
    const response = await apiClient.get<NotificationApiResponse>('/notifications');
    const responseData = response.data;

    if (Array.isArray(responseData)) {
      return responseData;
    }

    return responseData?.data ?? [];
  } catch (error) {
    console.error('[NotificationService] Error fetching notifications:', error);
    throw error;
  }
};

export const markNotificationAsRead = async (
  notificationId: string,
  isClicked = false
): Promise<void> => {
  try {
    await apiClient.post('/notifications/read', {
      notification_id: notificationId,
      is_clicked: isClicked,
    });
  } catch (error) {
    console.error('[NotificationService] Error marking notification as read:', error);
    throw error;
  }
};

export const markAllNotificationsAsRead = async (): Promise<number> => {
  try {
    const response = await apiClient.post<{ data?: { updated?: number } }>(
      '/notifications/read-all'
    );
    return response.data?.data?.updated ?? 0;
  } catch (error) {
    console.error('[NotificationService] Error marking all as read:', error);
    throw error;
  }
};

export const fetchUnreadNotificationCount = async (): Promise<number> => {
  const response = await apiClient.get<{ data?: { count?: number } }>(
    '/notifications/unread-count'
  );
  return response.data?.data?.count ?? 0;
};

export interface NotificationPreferences {
  types: Record<string, boolean>;
  in_app: boolean;
  push: boolean;
}

export const fetchNotificationPreferences = async (): Promise<NotificationPreferences> => {
  const response = await apiClient.get<{ data: NotificationPreferences }>(
    '/notifications/preferences'
  );
  return response.data.data;
};

export const updateNotificationPreferences = async (
  patch: Partial<NotificationPreferences> & { types?: Record<string, boolean> }
): Promise<NotificationPreferences> => {
  const response = await apiClient.put<{ data: NotificationPreferences }>(
    '/notifications/preferences',
    patch
  );
  return response.data.data;
};
