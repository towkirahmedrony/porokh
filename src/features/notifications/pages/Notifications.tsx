import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, Loader2 } from 'lucide-react';
import { supabase } from '@/shared/lib/supabase';
import { useAuth } from '../../auth/hooks/useAuth';
import { DBNotificationItem } from '../types/notificationTypes';
import NotificationHeader from '../components/NotificationHeader';
import NotificationItem from '../components/NotificationItem';
import NotificationEmptyState from '../components/NotificationEmptyState';
import NotificationDetailSheet from '../components/NotificationDetailSheet';
import { resolvePushTarget } from '../native/pushRouting';
import NoticeList from '@/features/notices/components/NoticeList';
import { useNotices } from '@/features/notices/hooks/useNotices';
import PullToRefresh from '../../groups/components/PullToRefresh';
import {
  fetchNotificationPage,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type NotificationPage,
} from '../services/notificationService';

type MarkReadVariables = { id: string; isClicked?: boolean };

/** Postgres timestamps arrive with an offset, not always with `Z`. */
const parseTimestamp = (iso: string): Date => {
  const direct = new Date(iso);
  if (!Number.isNaN(direct.getTime())) return direct;
  return new Date(`${iso}Z`);
};

const isSameLocalDay = (iso: string, reference: Date): boolean => {
  const date = parseTimestamp(iso);
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
};

const Notifications: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'notifications' | 'notices'>('notifications');
  const [selected, setSelected] = useState<DBNotificationItem | null>(null);
  const [extraItems, setExtraItems] = useState<DBNotificationItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const queryKey = useMemo(() => ['notifications', user?.id], [user?.id]);
  const unreadKey = useMemo(() => ['notifications', 'unreadCount', user?.id], [user?.id]);

  const { data: firstPage, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchNotificationPage(30),
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
  });

  const notifications = useMemo(
    () => [...(firstPage?.items ?? []), ...extraItems],
    [firstPage, extraItems]
  );

  const nextCursor = cursor ?? firstPage?.nextCursor ?? null;

  // A different account must not inherit the previous account's extra pages.
  useEffect(() => {
    setExtraItems([]);
    setCursor(null);
  }, [user?.id]);

  // Realtime keeps the bell and the list current while the screen is open. The
  // subscription is best-effort: a project without the notifications table in
  // its realtime publication still works through the pull-to-refresh path.
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `target_user_id=eq.${user.id}`,
        },
        () => {
          setExtraItems([]);
          setCursor(null);
          void queryClient.invalidateQueries({ queryKey });
          void queryClient.invalidateQueries({ queryKey: unreadKey });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient, queryKey, unreadKey]);

  const {
    data: noticeData,
    isLoading: noticesLoading,
    refetch: refetchNotices,
  } = useNotices();

  const filteredData = useMemo(
    () =>
      notifications.filter((item) =>
        activeTab === 'notifications'
          ? item.type !== 'global_notice'
          : item.type === 'global_notice'
      ),
    [notifications, activeTab]
  );

  const grouped = useMemo(() => {
    const today: DBNotificationItem[] = [];
    const earlier: DBNotificationItem[] = [];
    const now = new Date();

    filteredData.forEach((item) => {
      if (isSameLocalDay(item.created_at, now)) today.push(item);
      else earlier.push(item);
    });

    return { today, earlier };
  }, [filteredData]);

  const unreadCount = useMemo(
    () => filteredData.filter((item) => !item.notification_reads?.[0]?.is_read).length,
    [filteredData]
  );

  const markAsReadMutation = useMutation({
    mutationFn: ({ id, isClicked }: MarkReadVariables) =>
      markNotificationAsRead(id, isClicked),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey });

      const previousPage = queryClient.getQueryData(queryKey);
      const markRead = (list: DBNotificationItem[]) =>
        list.map((n) =>
          n.id === id
            ? { ...n, notification_reads: [{ is_read: true, is_clicked: true }] }
            : n
        );

      setExtraItems((prev) => markRead(prev));
      queryClient.setQueryData(queryKey, (old: NotificationPage | undefined) =>
        old ? { ...old, items: markRead(old.items) } : old
      );

      return { previousPage };
    },
    onError: (err, _variables, context) => {
      if (context?.previousPage) {
        queryClient.setQueryData(queryKey, context.previousPage);
      }
      console.error('Error updating read status via API:', err);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: unreadKey });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      const markAll = (list: DBNotificationItem[]) =>
        list.map((n) =>
          n.type === 'global_notice'
            ? n
            : { ...n, notification_reads: [{ is_read: true, is_clicked: false }] }
        );

      setExtraItems(markAll);
      queryClient.setQueryData(queryKey, (old: NotificationPage | undefined) =>
        old ? { ...old, items: markAll(old.items) } : old
      );
      void queryClient.invalidateQueries({ queryKey: unreadKey });
    },
    onError: (error) => {
      console.error('Error marking all notifications as read:', error);
    },
  });

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;

    setLoadingMore(true);
    try {
      const page = await fetchNotificationPage(30, nextCursor);
      setExtraItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch (error) {
      console.error('Error loading more notifications:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore]);

  const handleItemClick = useCallback(
    (item: DBNotificationItem) => {
      const isGlobalNotice = item.type === 'global_notice';
      const isRead = item.notification_reads?.[0]?.is_read ?? false;

      if (!isRead && user && !isGlobalNotice) {
        markAsReadMutation.mutate({
          id: item.id,
          isClicked: Boolean(item.action_link),
        });
      }

      // The detail sheet validates the stored link before it can navigate, so a
      // notification can never push the app to an arbitrary destination.
      setSelected(item);
    },
    [user, markAsReadMutation]
  );

  const handleOpenTarget = useCallback(
    (target: string) => {
      setSelected(null);
      navigate(resolvePushTarget(target));
    },
    [navigate]
  );

  const handleRefresh = useCallback(async () => {
    setExtraItems([]);
    setCursor(null);
    await queryClient.refetchQueries({ queryKey });
    await queryClient.refetchQueries({ queryKey: unreadKey });
    await refetchNotices();
  }, [queryClient, queryKey, unreadKey, refetchNotices]);

  const renderSection = (title: string, items: DBNotificationItem[]) => {
    if (items.length === 0) return null;
    return (
      <section className="space-y-2">
        <h2 className="px-1 text-[11px] font-bold uppercase tracking-wide text-text-secondary">
          {title}
        </h2>
        <div className="space-y-2">
          {items.map((item) => (
            <NotificationItem
              key={item.id}
              item={item}
              activeTab={activeTab}
              onClick={handleItemClick}
            />
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="min-h-screen flex flex-col font-['Noto_Sans_Bengali'] bg-bgApp text-textPrimary">
      <NotificationHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onBack={() => navigate(-1)}
      />

      {activeTab === 'notifications' && unreadCount > 0 && (
        <div className="flex justify-end px-4 pt-3">
          <button
            type="button"
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-full border border-border-color bg-surface px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-60"
          >
            <CheckCheck size={14} />
            {t('notification.markAllRead')}
          </button>
        </div>
      )}

      <PullToRefresh onRefresh={handleRefresh}>
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {activeTab === 'notices' ? (
            <NoticeList notices={noticeData?.items ?? []} isLoading={noticesLoading} />
          ) : isLoading ? (
            <div className="space-y-3" aria-label={t('common.loading')}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="flex items-start p-4 rounded-xl border border-cardBorder animate-pulse bg-cardBg"
                >
                  <div className="h-12 w-12 rounded-full bg-bgSurfaceElevated shrink-0"></div>
                  <div className="ml-4 flex-1 space-y-3 py-1">
                    <div className="h-4 bg-bgSurfaceElevated rounded w-3/4"></div>
                    <div className="h-3 bg-bgSurfaceElevated rounded w-full"></div>
                    <div className="h-3 bg-bgSurfaceElevated rounded w-5/6"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredData.length > 0 ? (
            <>
              {renderSection(t('notification.today'), grouped.today)}
              {renderSection(t('notification.earlier'), grouped.earlier)}

              {activeTab === 'notifications' && nextCursor && (
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="mx-auto flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-primary disabled:opacity-60"
                >
                  {loadingMore && <Loader2 size={14} className="animate-spin" />}
                  {loadingMore ? t('common.loading') : t('notification.loadMore')}
                </button>
              )}
            </>
          ) : (
            <NotificationEmptyState activeTab={activeTab} />
          )}
        </div>
      </PullToRefresh>

      <NotificationDetailSheet
        item={selected}
        onClose={() => setSelected(null)}
        onOpen={handleOpenTarget}
      />
    </div>
  );
};

export default Notifications;
