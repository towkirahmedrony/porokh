import React, { useState, useMemo, useCallback } from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCheck } from 'lucide-react';
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
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../services/notificationService';

type MarkReadVariables = { id: string; isClicked?: boolean };

const isSameLocalDay = (iso: string, reference: Date): boolean => {
  const date = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
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

  const queryKey = useMemo(() => ['notifications', user?.id], [user?.id]);
  const unreadKey = useMemo(() => ['notifications', 'unreadCount', user?.id], [user?.id]);

  const { data: notifications = [], isLoading } = useQuery<DBNotificationItem[]>({
    queryKey,
    queryFn: fetchNotifications,
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
  });

  const {
    data: noticeData,
    isLoading: noticesLoading,
    refetch: refetchNotices,
  } = useNotices();

  const filteredData = useMemo(() => {
    return notifications.filter((item) =>
      activeTab === 'notifications'
        ? item.type !== 'global_notice'
        : item.type === 'global_notice'
    );
  }, [notifications, activeTab]);

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

      const previousNotifications =
        queryClient.getQueryData<DBNotificationItem[]>(queryKey);

      if (previousNotifications) {
        queryClient.setQueryData<DBNotificationItem[]>(queryKey, (old) => {
          if (!old) return [];
          return old.map((n) =>
            n.id === id
              ? { ...n, notification_reads: [{ is_read: true, is_clicked: true }] }
              : n
          );
        });
      }

      return { previousNotifications };
    },
    onError: (err, _variables, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(queryKey, context.previousNotifications);
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
      queryClient.setQueryData<DBNotificationItem[]>(queryKey, (old) =>
        (old ?? []).map((n) =>
          n.type === 'global_notice'
            ? n
            : { ...n, notification_reads: [{ is_read: true, is_clicked: false }] }
        )
      );
      void queryClient.invalidateQueries({ queryKey: unreadKey });
    },
    onError: (error) => {
      console.error('Error marking all notifications as read:', error);
    },
  });

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
            <NoticeList
              notices={noticeData?.items ?? []}
              isLoading={noticesLoading}
            />
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
