import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Search, X, ArrowDownUp } from 'lucide-react';
import { useAuth } from '../../auth/hooks/useAuth';
import { TabType, HistoryItem } from '../types/history';
import { useHistory } from '../hooks/useHistory';
import { useExplorerCount } from '../hooks/useExplorer';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { formatCount } from '@/shared/lib/attemptFormat';

// Components
import { HistoryTabs } from '../components/HistoryTabs';
import { HistoryCard } from '../components/HistoryCard';
import { HistorySkeleton } from '../components/HistorySkeleton';
import { HistorySortSheet } from '../components/HistorySortSheet';
import { ExplorerTab } from '../components/ExplorerTab';
import { EmptyState } from '../components/EmptyState';
import { PullToRefresh } from '@/features/groups/components/PullToRefresh';
import { resolveTabViewState } from '../utils/historyViewState';
import {
  filterAndSortHistory,
  groupHistoryByDay,
  type HistorySortOrder,
} from '../utils/historyCard';
import type { AppMessageKey } from '@/shared/i18n/messages';

const PAGE_SIZE = 20;
const SCROLL_RESTORE_KEY = 'porokh.history.restore';

const DAY_GROUP_KEYS: Record<string, AppMessageKey> = {
  today: 'history.groupToday',
  yesterday: 'history.groupYesterday',
  week: 'history.groupWeek',
  earlier: 'history.groupEarlier',
};

interface RestoreSnapshot {
  scrollTop: number;
  visibleCount: number;
  savedAt: number;
}

const RESTORE_TTL_MS = 10 * 60 * 1000;

const clearRestoreSnapshot = () => {
  try {
    sessionStorage.removeItem(SCROLL_RESTORE_KEY);
  } catch {
    // Storage can be unavailable in a private webview.
  }
};

const readRestoreSnapshot = (): RestoreSnapshot | null => {
  try {
    const raw = sessionStorage.getItem(SCROLL_RESTORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RestoreSnapshot>;
    if (!Number.isFinite(parsed.scrollTop)) return null;
    return {
      scrollTop: Number(parsed.scrollTop),
      visibleCount: Math.max(PAGE_SIZE, Number(parsed.visibleCount) || PAGE_SIZE),
      savedAt: Number(parsed.savedAt) || 0,
    };
  } catch {
    return null;
  }
};

const scrollContainer = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('main');

/**
 * History owns the three tabs. Attempts keep their own list; Mistakes and
 * Bookmarks are rendered by ExplorerTab, which fetches ids first and question
 * bodies for the current page only.
 */
const History: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { language, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabType>('history');

  // List controls (history tab only, where titles and dates exist).
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<HistorySortOrder>('newest');
  const [sortOpen, setSortOpen] = useState(false);
  const [restoreSnapshot] = useState<RestoreSnapshot | null>(() => readRestoreSnapshot());
  const [visibleCount, setVisibleCount] = useState(
    restoreSnapshot?.visibleCount ?? PAGE_SIZE
  );
  const didMountRef = useRef(false);

  const { isLoading, isError, refetch, historyData } = useHistory();

  const mistakeCount = useExplorerCount('mistakes', Boolean(user));
  const bookmarkCount = useExplorerCount('bookmarks', Boolean(user));

  const textFontClass = language === 'bn' ? 'font-bengali' : 'font-sans';

  // Returning from a result restores the exact offset and page size the list
  // had when the card was tapped, instead of starting at the top.
  useEffect(() => {
    if (!restoreSnapshot) return;

    if (Date.now() - restoreSnapshot.savedAt > RESTORE_TTL_MS) {
      clearRestoreSnapshot();
      return;
    }

    const frame = requestAnimationFrame(() => {
      const main = scrollContainer();
      if (main) main.scrollTop = restoreSnapshot.scrollTop;
      clearRestoreSnapshot();
    });

    return () => cancelAnimationFrame(frame);
  }, [restoreSnapshot]);

  // Reset pagination when the list changes shape, but not on the first render
  // (that would discard a restored page size).
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    setVisibleCount(PAGE_SIZE);
  }, [activeTab, sortOrder]);

  const filteredHistory = useMemo(
    () => filterAndSortHistory(historyData, searchQuery, sortOrder, language, t),
    [historyData, searchQuery, sortOrder, language, t]
  );

  const visibleHistory = filteredHistory.slice(0, visibleCount);
  const hasMore = visibleCount < filteredHistory.length;
  const hasActiveSearch = searchQuery.trim().length > 0;

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Infinite scroll: the observer only exists while another page remains, so
  // the end of the list costs nothing.
  useEffect(() => {
    if (activeTab !== 'history' || !hasMore) return;

    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((count) =>
            Math.min(count + PAGE_SIZE, filteredHistory.length)
          );
        }
      },
      { root: scrollContainer(), rootMargin: '240px 0px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeTab, hasMore, filteredHistory.length, visibleCount]);

  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(event.target.value);
      setVisibleCount(PAGE_SIZE);
    },
    []
  );

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setVisibleCount(PAGE_SIZE);
  }, []);

  const handleOpenCard = useCallback(() => {
    const main = scrollContainer();
    if (!main) return;

    try {
      sessionStorage.setItem(
        SCROLL_RESTORE_KEY,
        JSON.stringify({
          scrollTop: main.scrollTop,
          visibleCount,
          savedAt: Date.now(),
        })
      );
    } catch {
      // Storage can be unavailable in a private webview; navigation still works.
    }
  }, [visibleCount]);

  // Pull-to-refresh reloads the visible tab. Invalidate marks the explorer
  // queries stale, and the mounted tab refetches them immediately.
  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['history-explorer'] });
    return refetch();
  }, [queryClient, refetch]);

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    const main = scrollContainer();
    if (main) main.scrollTop = 0;
  }, []);

  if (!user) return null;

  // A failed request must never render a "no mistakes yet" empty state.
  const tabViewState = resolveTabViewState({
    isLoading: activeTab === 'history' ? isLoading : false,
    isError: activeTab === 'history' ? isError : false,
    itemCount: historyData.length,
  });

  const header = (
    <div className="space-y-3">
      <h1 className="text-xl font-bold leading-7 text-text-primary">
        {t('history.title')}
      </h1>
      <HistoryTabs
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        counts={{ mistakes: mistakeCount, bookmarks: bookmarkCount }}
      />
    </div>
  );

  if (tabViewState === 'error') {
    return (
      <div className={`mx-auto flex w-full max-w-md flex-col gap-5 pb-4 ${textFontClass}`}>
        {header}
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-4 rounded-[20px] bg-card-bg px-5 py-12 text-center"
        >
          <div>
            <h3 className="text-[15px] font-bold text-text-primary">
              {t('history.errorTitle')}
            </h3>
            <p className="mt-1 text-[13px] leading-6 text-text-secondary">
              {t('history.errorMessage')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="min-h-[44px] rounded-xl bg-primary px-6 text-[13px] font-bold text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {t('history.retry')}
          </button>
        </div>
      </div>
    );
  }

  const renderToolbar = () => {
    if (activeTab !== 'history') return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={handleSearchChange}
              aria-label={t('history.searchLabel')}
              placeholder={t('history.searchPlaceholder')}
              className="h-11 w-full rounded-xl bg-card-bg pl-9 pr-11 text-[13px] text-text-primary placeholder:text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring [&::-webkit-search-cancel-button]:hidden"
            />
            {hasActiveSearch ? (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label={t('history.clearSearch')}
                className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-xl text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setSortOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={sortOpen}
            aria-label={`${t('history.sortLabel')}: ${
              sortOrder === 'newest' ? t('history.sortNewest') : t('history.sortOldest')
            }`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-card-bg text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <ArrowDownUp className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </div>

        {!isLoading && historyData.length > 0 ? (
          <p className="px-1 text-[11px] leading-4 text-text-secondary" aria-live="polite">
            {t('history.resultsCount', {
              count: formatCount(filteredHistory.length, language),
            })}
            {sortOrder === 'oldest' ? ` · ${t('history.sortOldest')}` : ''}
          </p>
        ) : null}
      </div>
    );
  };

  const renderHistoryList = () => {
    if (historyData.length === 0) return <EmptyState type="history" />;

    if (filteredHistory.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[20px] bg-card-bg px-5 py-12 text-center">
          <h3 className="text-[15px] font-bold text-text-primary">
            {t('history.noMatchesTitle')}
          </h3>
          <p className="text-[13px] leading-6 text-text-secondary">
            {t('history.noMatchesMessage')}
          </p>
          <button
            type="button"
            onClick={handleClearSearch}
            className="min-h-[44px] rounded-xl bg-primary px-5 text-[13px] font-bold text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {t('history.clearSearch')}
          </button>
        </div>
      );
    }

    const groups = groupHistoryByDay(
      visibleHistory,
      (item: HistoryItem) => item.submitted_at || item.created_at || item.taken_at
    );

    return (
      <div className="space-y-5">
        {groups.map((group) => (
          <section key={group.key} aria-labelledby={`history-group-${group.key}`}>
            <h2
              id={`history-group-${group.key}`}
              className="mb-2 px-1 text-[12px] font-semibold leading-5 text-text-secondary"
            >
              {t(DAY_GROUP_KEYS[group.key])}
            </h2>
            <div className="space-y-3">
              {group.items.map((item) => (
                <HistoryCard key={item.id} item={item} onOpen={handleOpenCard} />
              ))}
            </div>
          </section>
        ))}

        {hasMore ? (
          <div ref={sentinelRef} className="h-10" aria-hidden="true" />
        ) : null}
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'history':
        return renderHistoryList();

      case 'mistakes':
        return <ExplorerTab source="mistakes" />;

      case 'bookmarks':
        return <ExplorerTab source="bookmarks" />;

      default:
        return null;
    }
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className={`mx-auto flex w-full max-w-md flex-col gap-5 pb-4 ${textFontClass}`}>
        {header}

        {renderToolbar()}

        {tabViewState === 'loading' ? (
          <HistorySkeleton label={t('history.loading')} />
        ) : (
          <div className="animate-in fade-in duration-300 motion-reduce:animate-none">
            {renderTabContent()}
          </div>
        )}
      </div>

      <HistorySortSheet
        open={sortOpen}
        value={sortOrder}
        onClose={() => setSortOpen(false)}
        onChange={setSortOrder}
      />
    </PullToRefresh>
  );
};

export default History;
