import { apiClient } from '@/shared/lib/apiClient';
import { DBNotificationItem } from '../types/notificationTypes';

// === API Functions (Typed & Hardened) ===
//
// Notification delivery is owned by FCM on Android (see native/nativePush), and
// the records themselves are always read from Supabase through the API.

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
