import { apiClient } from '@/shared/lib/apiClient';
import { DBNotificationItem } from '../types/notificationTypes';

// === API Functions (Typed & Hardened) ===
//
// Delivery is owned by FCM on Android (see native/nativePush); the records
// themselves are read through the API, which applies the user's cursor page in
// SQL instead of returning the whole inbox.

type NotificationPagePayload = {
  items: DBNotificationItem[];
  next_cursor: string | null;
};

type NotificationApiResponse =
  | DBNotificationItem[]
  | NotificationPagePayload
  | { data: DBNotificationItem[] | NotificationPagePayload };

export interface NotificationPage {
  items: DBNotificationItem[];
  nextCursor: string | null;
}

const toPage = (payload: NotificationApiResponse | undefined): NotificationPage => {
  if (!payload) return { items: [], nextCursor: null };

  if (Array.isArray(payload)) return { items: payload, nextCursor: null };

  if ('data' in payload && payload.data) {
    return toPage(payload.data as NotificationApiResponse);
  }

  const page = payload as NotificationPagePayload;
  return {
    items: Array.isArray(page.items) ? page.items : [],
    nextCursor: page.next_cursor ?? null,
  };
};

export const fetchNotificationPage = async (
  limit = 30,
  before?: string | null
): Promise<NotificationPage> => {
  try {
    const response = await apiClient.get<NotificationApiResponse>('/notifications', {
      params: {
        limit,
        ...(before ? { before } : {}),
      },
    });

    return toPage(response.data);
  } catch (error) {
    console.error('[NotificationService] Error fetching notifications:', error);
    throw error;
  }
};

/** First page only; kept for callers that still expect an array. */
export const fetchNotifications = async (): Promise<DBNotificationItem[]> => {
  const page = await fetchNotificationPage();
  return page.items;
};

export const markNotificationAsRead = async (
  notificationId: string,
  isClicked = false
): Promise<void> => {
  try {
    if (isClicked) {
      await apiClient.post(`/notifications/${notificationId}/click`, {
        platform: 'android',
      });
      return;
    }

    await apiClient.post(`/notifications/${notificationId}/read`);
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
  /** Always true; in-app rows cannot be turned off. */
  in_app: boolean;
  push: boolean;
  quiet_start: string;
  quiet_end: string;
  timezone: string;
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
