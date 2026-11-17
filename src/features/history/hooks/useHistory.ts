import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/shared/lib/apiClient';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { TabType, MistakeItem, BookmarkItem } from '../types/history';
import { getExamHistory } from '../services/historyService';

export const useHistory = (activeTab: TabType) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // The cache is persisted for offline use, so it must be scoped to the signed
  // in student: a second user on the same device must never read the first
  // user's attempts or mistakes from the cache.
  const userId = user?.id ?? 'anonymous';
  const examsKey = ['history', 'exams', userId] as const;
  const mistakesKey = ['history', 'mistakes', userId] as const;
  const bookmarksKey = ['history', 'bookmarks', userId] as const;

  // 1. History Query
  const {
    data: historyData = [],
    isLoading: isHistoryLoading,
    isError: isHistoryError,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: examsKey,
    queryFn: getExamHistory,
    enabled: activeTab === 'history',
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // 2. Mistakes Query
  const {
    data: mistakeData = [],
    isLoading: isMistakeLoading,
    isError: isMistakeError,
    refetch: refetchMistakes,
  } = useQuery({
    queryKey: mistakesKey,
    queryFn: async () => {
      const { data } = await apiClient.get('/history/mistakes');
      // A malformed or failed payload must surface as an error, never as an
      // empty list: an empty list renders "কোনো ভুল নেই".
      if (!Array.isArray(data?.data)) {
        throw new Error('Unexpected mistakes response');
      }
      return data.data as MistakeItem[];
    },
    enabled: activeTab === 'mistakes',
    staleTime: 5 * 60 * 1000,
  });

  // 3. Bookmarks Query
  const {
    data: bookmarkData = [],
    isLoading: isBookmarkLoading,
    isError: isBookmarkError,
    refetch: refetchBookmarks,
  } = useQuery({
    queryKey: bookmarksKey,
    queryFn: async () => {
      const { data } = await apiClient.get('/history/bookmarks');
      if (!Array.isArray(data?.data)) {
        throw new Error('Unexpected bookmarks response');
      }
      return data.data as BookmarkItem[];
    },
    enabled: activeTab === 'bookmarks',
    staleTime: 5 * 60 * 1000,
  });

  // Mutations for Optimistic Updates / Cache Invalidation
  const deleteMistakeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/history/mistakes/${id}`);
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<MistakeItem[]>(mistakesKey, (old) =>
        old ? old.filter((item) => item.id !== id) : []
      );
      queryClient.invalidateQueries({ queryKey: mistakesKey });
    },
  });

  const deleteBookmarkMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/history/bookmarks/${id}`);
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<BookmarkItem[]>(bookmarksKey, (old) =>
        old ? old.filter((item) => item.id !== id) : []
      );
      queryClient.invalidateQueries({ queryKey: bookmarksKey });
      queryClient.invalidateQueries({ queryKey: ['exams', 'bookmarks'] });
      queryClient.invalidateQueries({ queryKey: ['question-bank', 'questions'] });
    },
  });

  // Combined Loading State
  const isLoading = 
    (activeTab === 'history' && isHistoryLoading) ||
    (activeTab === 'mistakes' && isMistakeLoading) ||
    (activeTab === 'bookmarks' && isBookmarkLoading);

  // Combined Error / Refetch for the tab that is currently visible
  const isError =
    (activeTab === 'history' && isHistoryError) ||
    (activeTab === 'mistakes' && isMistakeError) ||
    (activeTab === 'bookmarks' && isBookmarkError);

  const refetch = useCallback(() => {
    if (activeTab === 'history') return refetchHistory();
    if (activeTab === 'mistakes') return refetchMistakes();
    return refetchBookmarks();
  }, [activeTab, refetchHistory, refetchMistakes, refetchBookmarks]);

  // Wrappers to match the existing API signature expected by History.tsx
  const deleteMistake = useCallback(async (id: string) => {
    try {
      await deleteMistakeMutation.mutateAsync(id);
      return true;
    } catch (error) {
      console.error('Error deleting mistake:', error);
      return false;
    }
  }, [deleteMistakeMutation]);

  const deleteBookmark = useCallback(async (id: string) => {
    try {
      await deleteBookmarkMutation.mutateAsync(id);
      return true;
    } catch (error) {
      console.error('Error deleting bookmark:', error);
      return false;
    }
  }, [deleteBookmarkMutation]);

  return {
    isLoading,
    isError,
    refetch,
    historyData,
    mistakeData,
    bookmarkData,
    deleteMistake,
    deleteBookmark,
  };
};

export default useHistory;
