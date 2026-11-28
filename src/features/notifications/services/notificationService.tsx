import { apiClient } from '@/shared/lib/apiClient';
import { supabase } from '@/shared/lib/supabase';
import { DBNotificationItem } from '../types/notificationTypes';

// === Inbox (database RPCs) ===
//
// The inbox definition lives in SQL: notification_inbox() decides which rows a
// user may see, get_my_notifications() pages them with the user's read state,
// and get_my_unread_notification_count() is the single badge number. Reading
// through these functions means the list, the badge, the realtime channel and
// the backend all agree on what "unread" means.
//
// Delivery is still owned by FCM on Android (see native/nativePush).

type NotificationRpcRow = {
  id: string;
  title_en: string | null;
  title_bn: string | null;
  body_en: string | null;
  body_bn: string | null;
  image_url: string | null;
  action_link: string | null;
  type: string;
  priority: string | null;
  event_code: string | null;
  created_at: string;
  is_read: boolean;
  read_at: string | null;
  is_clicked: boolean;
  clicked_at: string | null;
};

export interface NotificationPage {
  items: DBNotificationItem[];
  nextCursor: string | null;
}

/**
 * A cursor is `<created_at>|<id>`: created_at alone is not unique, so two
 * notifications saved in the same instant could otherwise repeat or vanish
 * between pages.
 */
const encodeCursor = (item: DBNotificationItem): string =>
  `${item.created_at}|${item.id}`;

const decodeCursor = (
  cursor?: string | null
): { createdAt: string; id: string } | null => {
  if (!cursor) return null;
  const separator = cursor.lastIndexOf('|');
  if (separator <= 0) return null;
  return { createdAt: cursor.slice(0, separator), id: cursor.slice(separator + 1) };
};

/** RPC rows carry the read state flat; components expect notification_reads. */
const toInboxItem = (row: NotificationRpcRow): DBNotificationItem => ({
  id: row.id,
  title_en: row.title_en ?? '',
  title_bn: row.title_bn,
  body_en: row.body_en ?? '',
  body_bn: row.body_bn,
  type: row.type,
  event_code: row.event_code,
  priority: row.priority,
  image_url: row.image_url,
  action_link: row.action_link,
  created_at: row.created_at,
  notification_reads: [
    { is_read: Boolean(row.is_read), is_clicked: Boolean(row.is_clicked) },
  ],
});

export const fetchNotificationPage = async (
  limit = 30,
  before?: string | null
): Promise<NotificationPage> => {
  const cursor = decodeCursor(before);

  const { data, error } = await supabase.rpc('get_my_notifications', {
    p_limit: limit,
    p_before: cursor?.createdAt ?? null,
    p_before_id: cursor?.id ?? null,
  });

  if (error) {
    console.error('[NotificationService] Error fetching notifications:', error);
    throw error;
  }

  const items = ((data ?? []) as NotificationRpcRow[]).map(toInboxItem);
  const last = items[items.length - 1];

  // A short page is the end of the inbox.
  return {
    items,
    nextCursor: last && items.length === limit ? encodeCursor(last) : null,
  };
};

/** First page only; kept for callers that still expect an array. */
export const fetchNotifications = async (): Promise<DBNotificationItem[]> => {
  const page = await fetchNotificationPage();
  return page.items;
};

/**
 * Marks one notification read, or read+clicked. A tap on a notification that
 * opens its action_link is a click, which is what the backend reports as
 * engagement.
 */
export const markNotificationAsRead = async (
  notificationId: string,
  isClicked = false,
  platform = 'android'
): Promise<void> => {
  if (isClicked) {
    const { error } = await supabase.rpc('mark_notification_clicked', {
      p_notification_id: notificationId,
      p_platform: platform,
    });
    if (error) {
      console.error('[NotificationService] Error marking notification clicked:', error);
      throw error;
    }
    return;
  }

  const { error } = await supabase.rpc('mark_notification_read', {
    p_notification_id: notificationId,
  });
  if (error) {
    console.error('[NotificationService] Error marking notification as read:', error);
    throw error;
  }
};

export const markAllNotificationsAsRead = async (): Promise<number> => {
  const { data, error } = await supabase.rpc('mark_all_notifications_read');
  if (error) {
    console.error('[NotificationService] Error marking all as read:', error);
    throw error;
  }
  return data ?? 0;
};

export const fetchUnreadNotificationCount = async (): Promise<number> => {
  const { data, error } = await supabase.rpc('get_my_unread_notification_count');
  if (error) {
    // A badge is not worth an error screen: an unknown count renders as zero
    // and the next refetch corrects it.
    console.warn('[NotificationService] unread count unavailable:', error.message);
    return 0;
  }
  return data ?? 0;
};

export interface NotificationPreferences {
  types: Record<string, boolean>;
  /** Always true; in-app rows cannot be turned off. */
  in_app: boolean;
  push: boolean;
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
