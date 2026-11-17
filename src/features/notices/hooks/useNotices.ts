import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  dismissNotice,
  fetchNotice,
  fetchNotices,
  fetchUnreadNoticeCount,
  fetchUrgentNotice,
  markNoticeRead,
} from '../services/noticeService';

export const noticeKeys = {
  all: ['notices'] as const,
  list: (userId?: string) => ['notices', 'list', userId] as const,
  unread: (userId?: string) => ['notices', 'unreadCount', userId] as const,
  urgent: (userId?: string) => ['notices', 'urgent', userId] as const,
  detail: (userId: string | undefined, noticeId: string) =>
    ['notices', 'detail', userId, noticeId] as const,
};

export const useNotices = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: noticeKeys.list(user?.id),
    queryFn: () => fetchNotices({ limit: 50 }),
    enabled: !!user?.id,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });
};

export const useNotice = (noticeId: string | undefined) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: noticeKeys.detail(user?.id, noticeId ?? ''),
    queryFn: () => fetchNotice(noticeId as string),
    enabled: !!user?.id && !!noticeId,
    staleTime: 60 * 1000,
  });
};

export const useUnreadNoticeCount = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: noticeKeys.unread(user?.id),
    queryFn: fetchUnreadNoticeCount,
    enabled: !!user?.id,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });
};

export const useUrgentNotice = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: noticeKeys.urgent(user?.id),
    queryFn: fetchUrgentNotice,
    enabled: !!user?.id,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });
};

const invalidateNoticeQueries = (
  queryClient: ReturnType<typeof useQueryClient>,
  userId?: string
) => {
  void queryClient.invalidateQueries({ queryKey: noticeKeys.list(userId) });
  void queryClient.invalidateQueries({ queryKey: noticeKeys.unread(userId) });
  void queryClient.invalidateQueries({ queryKey: noticeKeys.urgent(userId) });
};

export const useMarkNoticeRead = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markNoticeRead,
    onSuccess: (_data, noticeId) => {
      queryClient.setQueryData(
        noticeKeys.detail(user?.id, noticeId),
        (old: { is_read?: boolean } | undefined) =>
          old ? { ...old, is_read: true } : old
      );
      queryClient.setQueryData(
        noticeKeys.list(user?.id),
        (old: { items?: Array<{ id: string; is_read?: boolean }> } | undefined) =>
          old?.items
            ? {
                ...old,
                items: old.items.map((item) =>
                  item.id === noticeId ? { ...item, is_read: true } : item
                ),
              }
            : old
      );
      invalidateNoticeQueries(queryClient, user?.id);
    },
  });
};

export const useDismissNotice = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: dismissNotice,
    onSuccess: (_data, noticeId) => {
      queryClient.setQueryData(
        noticeKeys.urgent(user?.id),
        (old: { id?: string } | null | undefined) =>
          old?.id === noticeId ? null : old
      );
      invalidateNoticeQueries(queryClient, user?.id);
    },
  });
};
