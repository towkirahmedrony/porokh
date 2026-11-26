import { useCallback, useMemo } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import type {
  ExplorerFilters,
  ExplorerItem,
  ExplorerSort,
  ExplorerSource,
  FacetMap,
} from '../types/explorer';
import explorerService from '../services/explorerService';

const PAGE_SIZE = 20;

const queryPrefix = (userId: string) => ['history-explorer', userId] as const;

const listKey = (
  userId: string,
  source: ExplorerSource,
  filters: ExplorerFilters,
  sort: ExplorerSort
) => [...queryPrefix(userId), 'list', source, filters, sort] as const;

const facetKey = (userId: string, source: ExplorerSource) =>
  [...queryPrefix(userId), 'facets', source] as const;

/**
 * One paged list per tab. The filters and the sort are part of the query key, so
 * changing a filter starts a fresh page instead of mutating the visible array,
 * and coming back from a sheet keeps the already loaded pages in cache.
 */
export const useExplorerList = (
  source: ExplorerSource,
  filters: ExplorerFilters,
  sort: ExplorerSort,
  enabled: boolean
) => {
  const { user } = useAuth();
  const userId = user?.id ?? 'anonymous';

  const query = useInfiniteQuery({
    queryKey: listKey(userId, source, filters, sort),
    queryFn: ({ pageParam }) =>
      explorerService.getPage({
        source,
        filters,
        sort,
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? lastPage.offset + lastPage.limit : undefined,
    enabled,
    staleTime: 60 * 1000,
  });

  const items = useMemo(
    () => (query.data?.pages ?? []).flatMap((page) => page.items),
    [query.data]
  );

  const total = query.data?.pages?.[0]?.total ?? 0;

  return {
    ...query,
    items,
    total,
    hasMore: Boolean(query.hasNextPage),
    loadMore: query.fetchNextPage,
  };
};

/** Counts for the tab labels; they only change when the pool changes. */
export const useExplorerCount = (source: ExplorerSource, enabled: boolean) => {
  const { user } = useAuth();
  const userId = user?.id ?? 'anonymous';

  const { data = 0 } = useQuery({
    queryKey: [...queryPrefix(userId), 'count', source],
    queryFn: () => explorerService.getCount(source, {}),
    enabled,
    staleTime: 60 * 1000,
  });

  return data;
};

/** Facet counts for a draft selection, so the sheet's numbers follow the filters. */
export const useExplorerDraftFacets = (
  source: ExplorerSource,
  filters: ExplorerFilters,
  enabled: boolean
) => {
  const { user } = useAuth();
  const userId = user?.id ?? 'anonymous';

  const { data, isFetching } = useQuery({
    queryKey: [...queryPrefix(userId), 'draft-facets', source, filters],
    queryFn: () => explorerService.getFacets(source, filters),
    enabled,
    staleTime: 60 * 1000,
  });

  return { facets: (data?.facets ?? {}) as FacetMap, isFetching };
};

export const useExplorerFacets = (source: ExplorerSource, enabled: boolean) => {
  const { user } = useAuth();
  const userId = user?.id ?? 'anonymous';

  const { data, isLoading } = useQuery({
    queryKey: facetKey(userId, source),
    queryFn: () => explorerService.getFacets(source, {}),
    enabled,
    staleTime: 2 * 60 * 1000,
  });

  return {
    facets: (data?.facets ?? {}) as FacetMap,
    isLoading,
  };
};

/** Live count for a draft selection in the filter or practice sheet. */
export const useExplorerDraftCount = (
  source: ExplorerSource,
  filters: ExplorerFilters,
  enabled: boolean
) => {
  const { user } = useAuth();
  const userId = user?.id ?? 'anonymous';

  return useQuery({
    queryKey: [...queryPrefix(userId), 'draft-count', source, filters],
    queryFn: () => explorerService.getCount(source, filters),
    enabled,
    staleTime: 15 * 1000,
  });
};

interface DismissPayload {
  item: ExplorerItem;
  itemIndex: number;
}

/**
 * Removing a mistake dismisses the question; the snackbar undoes it by deleting
 * the dismissal, so the question returns to the same place in the list.
 */
export const useExplorerActions = (source: ExplorerSource) => {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { user } = useAuth();
  const userId = user?.id ?? 'anonymous';

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryPrefix(userId) });
    queryClient.invalidateQueries({ queryKey: ['history'] });
  }, [queryClient, userId]);

  const dismissMutation = useMutation({
    mutationFn: (payload: DismissPayload) =>
      explorerService.dismissMistake(payload.item.question_id),
    onSuccess: (_result, payload) => {
      invalidate();

      toast(
        (toastInstance) => (
          <span className="flex items-center gap-3">
            <span className="text-[13px]">{t('history.explorerDismissed')}</span>
            <button
              type="button"
              onClick={async () => {
                toast.dismiss(toastInstance.id);
                try {
                  await explorerService.restoreMistakes([payload.item.question_id]);
                  invalidate();
                } catch {
                  toast.error(t('history.explorerUndoFailed'));
                }
              }}
              className="min-h-[36px] rounded-lg px-2 text-[13px] font-bold text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {t('history.explorerUndo')}
            </button>
          </span>
        ),
        { duration: 6000 }
      );
    },
    onError: () => toast.error(t('history.explorerDismissFailed')),
  });

  const removeBookmarkMutation = useMutation({
    mutationFn: (payload: DismissPayload) =>
      explorerService.removeBookmark(payload.item.item_id ?? payload.item.question_id),
    onSuccess: (_result, payload) => {
      invalidate();

      toast(
        (toastInstance) => (
          <span className="flex items-center gap-3">
            <span className="text-[13px]">{t('history.explorerBookmarkRemoved')}</span>
            <button
              type="button"
              onClick={async () => {
                toast.dismiss(toastInstance.id);
                try {
                  await explorerService.addBookmark(
                    payload.item.question_id,
                    payload.item.note
                  );
                  invalidate();
                } catch {
                  toast.error(t('history.explorerUndoFailed'));
                }
              }}
              className="min-h-[36px] rounded-lg px-2 text-[13px] font-bold text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {t('history.explorerUndo')}
            </button>
          </span>
        ),
        { duration: 6000 }
      );
    },
    onError: () => toast.error(t('history.explorerBookmarkRemoveFailed')),
  });

  const noteMutation = useMutation({
    mutationFn: (payload: { bookmarkId: string; note: string }) =>
      explorerService.updateNote(payload.bookmarkId, payload.note),
    onSuccess: () => {
      invalidate();
      toast.success(t('history.explorerNoteSaved'));
    },
    onError: () => toast.error(t('history.explorerNoteFailed')),
  });

  const remove = useCallback(
    (item: ExplorerItem, itemIndex: number) => {
      if (source === 'bookmarks') {
        removeBookmarkMutation.mutate({ item, itemIndex });
        return;
      }
      dismissMutation.mutate({ item, itemIndex });
    },
    [dismissMutation, removeBookmarkMutation, source]
  );

  return {
    remove,
    saveNote: noteMutation.mutateAsync,
    isRemoving: dismissMutation.isPending || removeBookmarkMutation.isPending,
    isSavingNote: noteMutation.isPending,
  };
};
