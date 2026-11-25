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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { supabase } from '@/shared/lib/supabase';
import { useAuth } from '../../auth/hooks/useAuth';
import type { DBNotificationItem } from '../types/notificationTypes';
import {
  fetchNotificationPage,
  fetchUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type NotificationPage,
} from '../services/notificationService';

/**
 * Query keys are shared with anything that invalidates the inbox (foreground
 * push, exam submit), so there is exactly one cached list and one badge number.
 */
export const inboxKeys = {
  list: (userId?: string | null) => ['notifications', userId] as const,
  unread: (userId?: string | null) => ['notifications', 'unreadCount', userId] as const,
};

const PAGE_SIZE = 30;

interface InboxContextValue {
  items: DBNotificationItem[];
  unreadCount: number;
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  /** Refetches page 1 and the badge; used on entry, resume and pull-to-refresh. */
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  markRead: (id: string, options?: { clicked?: boolean }) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const InboxContext = createContext<InboxContextValue | null>(null);

const markLocallyRead = (
  list: DBNotificationItem[],
  id: string,
  clicked: boolean
): DBNotificationItem[] =>
  list.map((item) =>
    item.id === id
      ? {
          ...item,
          notification_reads: [
            {
              is_read: true,
              is_clicked: clicked || Boolean(item.notification_reads?.[0]?.is_clicked),
            },
          ],
        }
      : item
  );

/**
 * Single owner of the notification inbox.
 *
 * It lives above the routes, so the realtime subscription and the badge survive
 * navigation, and page entry only triggers a refetch instead of creating a new
 * channel. The list and the badge both come from the database functions
 * (get_my_notifications / get_my_unread_notification_count), which keeps them
 * consistent with each other and with the backend.
 */
export const InboxProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  const [extraItems, setExtraItems] = useState<DBNotificationItem[]>([]);
  const [pageState, setPageState] = useState<{ cursor: string | null; active: boolean }>({
    cursor: null,
    active: false,
  });
  const [loadingMore, setLoadingMore] = useState(false);

  const listKey = useMemo(() => inboxKeys.list(userId), [userId]);
  const unreadKey = useMemo(() => inboxKeys.unread(userId), [userId]);

  const firstPage = useQuery({
    queryKey: listKey,
    queryFn: () => fetchNotificationPage(PAGE_SIZE),
    enabled: !!userId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const unread = useQuery({
    queryKey: unreadKey,
    queryFn: fetchUnreadNotificationCount,
    enabled: !!userId,
    staleTime: 0,
  });

  const items = useMemo(
    () => [...(firstPage.data?.items ?? []), ...extraItems],
    [firstPage.data, extraItems]
  );

  const nextCursor = pageState.active
    ? pageState.cursor
    : firstPage.data?.nextCursor ?? null;

  // A different account must not inherit the previous account's extra pages.
  useEffect(() => {
    setExtraItems([]);
    setPageState({ cursor: null, active: false });
  }, [userId]);

  const itemsRef = useRef(items);
  itemsRef.current = items;

  const resetPagination = useCallback(() => {
    setExtraItems([]);
    setPageState({ cursor: null, active: false });
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;

    resetPagination();
    await Promise.all([
      queryClient.refetchQueries({ queryKey: listKey, exact: true }),
      queryClient.refetchQueries({ queryKey: unreadKey, exact: true }),
    ]);
  }, [listKey, queryClient, resetPagination, unreadKey, userId]);

  // The channel is created once per signed-in user, after the session exists:
  // realtime authorises the connection with the current JWT, so subscribing
  // before sign-in would never deliver that user's rows.
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (cancelled || !sessionData.session?.access_token) return;

      channel = supabase
        .channel(`inbox:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `target_user_id=eq.${userId}`,
          },
          () => {
            resetPagination();
            void queryClient.invalidateQueries({ queryKey: listKey });
            void queryClient.invalidateQueries({ queryKey: unreadKey });
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [listKey, queryClient, resetPagination, unreadKey, userId]);

  // Coming back to the app (or tab) is the moment a push sent while it was in
  // the background becomes visible, so the inbox is refetched on resume.
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    let handle: PluginListenerHandle | null = null;

    if (Capacitor.isNativePlatform()) {
      void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) void refresh();
      }).then((registeredHandle) => {
        if (cancelled) {
          void registeredHandle.remove();
          return;
        }
        handle = registeredHandle;
      });
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (handle) void handle.remove();
    };
  }, [refresh, userId]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore || !userId) return;

    setLoadingMore(true);
    try {
      const page = await fetchNotificationPage(PAGE_SIZE, nextCursor);
      setExtraItems((prev) => [...prev, ...page.items]);
      setPageState({ cursor: page.nextCursor, active: true });
    } catch (error) {
      console.error('Error loading more notifications:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextCursor, userId]);

  const markRead = useCallback(
    async (id: string, options?: { clicked?: boolean }) => {
      const target = itemsRef.current.find((item) => item.id === id);
      const wasUnread = target ? !(target.notification_reads?.[0]?.is_read ?? false) : false;

      setExtraItems((prev) => markLocallyRead(prev, id, Boolean(options?.clicked)));
      queryClient.setQueryData<NotificationPage>(listKey, (old) =>
        old ? { ...old, items: markLocallyRead(old.items, id, Boolean(options?.clicked)) } : old
      );
      if (wasUnread) {
        queryClient.setQueryData<number>(unreadKey, (count) => Math.max(0, (count ?? 1) - 1));
      }

      try {
        await markNotificationAsRead(id, options?.clicked);
        // The database is the authority on the badge, so it is reconciled after
        // every mutation instead of trusting the optimistic number.
        void queryClient.invalidateQueries({ queryKey: unreadKey });
      } catch (error) {
        // A failed write must not leave the row looking read, and the caller
        // fires this without awaiting it, so the error is handled here.
        console.error('Error marking notification as read:', error);
        void queryClient.invalidateQueries({ queryKey: listKey });
        void queryClient.invalidateQueries({ queryKey: unreadKey });
      }
    },
    [listKey, queryClient, unreadKey]
  );

  const markAllRead = useCallback(async () => {
    setExtraItems((prev) =>
      prev.map((item) =>
        item.type === 'global_notice'
          ? item
          : { ...item, notification_reads: [{ is_read: true, is_clicked: false }] }
      )
    );
    queryClient.setQueryData<NotificationPage>(listKey, (old) =>
      old
        ? {
            ...old,
            items: old.items.map((item) =>
              item.type === 'global_notice'
                ? item
                : { ...item, notification_reads: [{ is_read: true, is_clicked: false }] }
            ),
          }
        : old
    );

    try {
      await markAllNotificationsAsRead();
    } finally {
      void queryClient.invalidateQueries({ queryKey: unreadKey });
      void queryClient.invalidateQueries({ queryKey: listKey });
    }
  }, [listKey, queryClient, unreadKey]);

  const value = useMemo<InboxContextValue>(
    () => ({
      items,
      unreadCount: unread.data ?? 0,
      loading: firstPage.isLoading,
      hasMore: Boolean(nextCursor),
      loadingMore,
      refresh,
      loadMore,
      markRead,
      markAllRead,
    }),
    [
      firstPage.isLoading,
      items,
      loadMore,
      loadingMore,
      markAllRead,
      markRead,
      nextCursor,
      refresh,
      unread.data,
    ]
  );

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
};

export const useInbox = (): InboxContextValue => {
  const value = useContext(InboxContext);
  if (!value) {
    throw new Error('useInbox must be used within an InboxProvider');
  }
  return value;
};
