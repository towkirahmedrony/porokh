import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Search, X, ArrowDownUp } from 'lucide-react';
import { useAuth } from '../../auth/hooks/useAuth';
import { TabType, HistoryItem } from '../types/history';
import { useHistory } from '../hooks/useHistory';
import { useLanguage } from '@/shared/i18n/LanguageProvider';

// Components
import { HistoryTabs } from '../components/HistoryTabs';
import { HistoryCard } from '../components/HistoryCard';
import { MistakeCard } from '../components/MistakeCard';
import { BookmarkCard } from '../components/BookmarkCard';
import { DeleteModal } from '../components/DeleteModal';
import { EmptyState } from '../components/EmptyState';
import { resolveTabViewState } from '../utils/historyViewState';

// Types
type DeleteTargetType = Extract<TabType, 'mistakes' | 'bookmarks'>;
type SortOrder = 'newest' | 'oldest';

interface DeleteModalState {
  isOpen: boolean;
  id: string | null;
  type: DeleteTargetType | null;
}

const PAGE_SIZE = 20;

const getTimestamp = (item: HistoryItem): number => {
  const dateStr =
    item.submitted_at || item.created_at || item.taken_at || '';
  if (!dateStr) return 0;
  const time = new Date(dateStr).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const History: React.FC = () => {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabType>('history');

  // List controls (history tab only — titles/dates only exist there)
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Modal State
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
    isOpen: false,
    id: null,
    type: null
  });

  const { 
    isLoading, 
    isError,
    refetch,
    historyData, 
    mistakeData, 
    bookmarkData, 
    deleteMistake, 
    deleteBookmark 
  } = useHistory(activeTab);

  const textFontClass =
    language === 'bn' ? "font-['Noto_Sans_Bengali']" : 'font-sans';

  // Reset pagination whenever the list itself changes shape
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeTab, sortOrder]);

  // Chronological sorting + search by exam title (case-insensitive)
  const filteredHistory = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const matched = query
      ? historyData.filter((item) => {
          const searchableText = [
            item.exam_title,
            item.details_json?.exam_title,
            item.subject_name_en,
            item.subject_name_bn,
            ...(item.subjects ?? []).flatMap((subject) => [
              subject.name_en,
              subject.name_bn,
            ]),
          ]
            .filter((value): value is string => typeof value === 'string')
            .join(' ')
            .toLowerCase();
          return searchableText.includes(query);
        })
      : historyData;

    const sorted = [...matched].sort((a, b) => {
      const diff = getTimestamp(a) - getTimestamp(b);
      return sortOrder === 'newest' ? -diff : diff;
    });

    return sorted;
  }, [historyData, searchQuery, sortOrder]);

  const visibleHistory = filteredHistory.slice(0, visibleCount);
  const hasMore = visibleCount < filteredHistory.length;
  const hasActiveSearch = searchQuery.trim().length > 0;

  // Memoized Handlers for Modal
  const handleOpenDeleteModal = useCallback((id: string, type: DeleteTargetType) => {
    setDeleteModal({ isOpen: true, id, type });
  }, []);

  const handleCloseModal = useCallback(() => {
    setDeleteModal({ isOpen: false, id: null, type: null });
  }, []);

  // Stable references for child component props to prevent React.memo breakage
  const handleDeleteMistake = useCallback((id: string) => {
    handleOpenDeleteModal(id, 'mistakes');
  }, [handleOpenDeleteModal]);

  const handleDeleteBookmark = useCallback((id: string) => {
    handleOpenDeleteModal(id, 'bookmarks');
  }, [handleOpenDeleteModal]);

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

  const handleToggleSort = useCallback(() => {
    setSortOrder((order) => (order === 'newest' ? 'oldest' : 'newest'));
  }, []);

  const handleLoadMore = useCallback(() => {
    setVisibleCount((count) => count + PAGE_SIZE);
  }, []);

  // Cleaned up confirmation logic without redundant try-catch
  const confirmDelete = useCallback(async () => {
    const { id, type } = deleteModal;
    if (!id || !type) return;

    let success = false;
    
    // Mutation calls (they safely return boolean directly from useHistory hook)
    if (type === 'mistakes') {
      success = await deleteMistake(id);
    } else if (type === 'bookmarks') {
      success = await deleteBookmark(id);
    }

    if (success) {
      handleCloseModal();
    } else {
      console.error(`Failed to delete ${type} with id ${id}`);
    }
  }, [deleteModal, deleteMistake, deleteBookmark, handleCloseModal]);

  // Early return fallback
  if (!user) return null;

  const activeTabItemCount =
    activeTab === 'history'
      ? historyData.length
      : activeTab === 'mistakes'
        ? mistakeData.length
        : bookmarkData.length;

  // A failed request must never render the "no mistakes yet" empty state.
  // Cached rows stay visible when only a background refetch failed.
  const tabViewState = resolveTabViewState({
    isLoading,
    isError,
    itemCount: activeTabItemCount,
  });

  // Error state for the active tab (data retrieval failed)
  if (tabViewState === 'error') {
    return (
      <div className={`bg-app text-text-primary max-w-4xl mx-auto p-4 md:p-6 min-h-screen ${textFontClass}`}>
        <HistoryTabs activeTab={activeTab} setActiveTab={setActiveTab} />
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-4 py-16 text-center"
        >
          <div>
            <h3 className="text-xl font-bold mb-2 text-text-primary">
              {t('history.errorTitle')}
            </h3>
            <p className="text-sm max-w-sm mx-auto text-text-secondary">
              {t('history.errorMessage')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-app"
          >
            {t('history.retry')}
          </button>
        </div>
      </div>
    );
  }

  // Search + sort toolbar — only where titles and dates exist
  const renderToolbar = () => {
    if (activeTab !== 'history') return null;

    return (
      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={handleSearchChange}
            aria-label={t('history.searchLabel')}
            placeholder={t('history.searchPlaceholder')}
            className="w-full rounded-xl border border-border-color bg-card-bg py-2.5 pl-9 pr-9 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {hasActiveSearch && (
            <button
              type="button"
              onClick={handleClearSearch}
              aria-label={t('history.clearSearch')}
              title={t('history.clearSearch')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleToggleSort}
          aria-label={t('history.sortLabel')}
          title={sortOrder === 'newest' ? t('history.sortNewest') : t('history.sortOldest')}
          className="flex items-center justify-center gap-2 rounded-xl border border-border-color bg-card-bg px-3 py-2.5 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary sm:justify-start"
        >
          <ArrowDownUp className="h-4 w-4" aria-hidden="true" />
          {sortOrder === 'newest' ? t('history.sortNewest') : t('history.sortOldest')}
        </button>

        {!isLoading && !isError && historyData.length > 0 && (
          <p className="text-xs text-text-secondary sm:self-center" aria-live="polite">
            {t('history.resultsCount', {
              count: filteredHistory.length,
            })}
          </p>
        )}
      </div>
    );
  };

  const renderLoadMore = () => {
    if (activeTab !== 'history' || !hasMore) return null;

    return (
      <div className="flex flex-col items-center gap-2 pt-2">
        <p className="text-xs text-text-secondary">
          {t('history.showing', {
            shown: visibleHistory.length,
            total: filteredHistory.length,
          })}
        </p>
        <button
          type="button"
          onClick={handleLoadMore}
          className="rounded-xl border border-border-color bg-card-bg px-6 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-app"
        >
          {t('history.loadMore')}
        </button>
      </div>
    );
  };

  // Render Helper
  const renderTabContent = () => {
    switch (activeTab) {
      case 'history':
        if (historyData.length === 0) {
          return <EmptyState type="history" />;
        }

        if (filteredHistory.length === 0) {
          return (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <h3 className="text-lg font-bold text-text-primary">
                {t('history.noMatchesTitle')}
              </h3>
              <p className="text-sm max-w-xs mx-auto text-text-secondary">
                {t('history.noMatchesMessage')}
              </p>
              <button
                type="button"
                onClick={handleClearSearch}
                className="rounded-full border border-border-color bg-card-bg px-5 py-2 text-sm font-semibold text-primary transition-colors hover:bg-surface-elevated"
              >
                {t('history.clearSearch')}
              </button>
            </div>
          );
        }

        return (
          <>
            {visibleHistory.map((item) => (
              <HistoryCard key={item.id} item={item} />
            ))}
            {renderLoadMore()}
          </>
        );

      case 'mistakes':
        return mistakeData && mistakeData.length > 0 ? (
          mistakeData.map((item) => (
            <MistakeCard 
              key={item.id} 
              item={item} 
              onDelete={handleDeleteMistake} 
            />
          ))
        ) : (
          <EmptyState type="mistakes" />
        );

      case 'bookmarks':
        return bookmarkData && bookmarkData.length > 0 ? (
          bookmarkData.map((item) => (
            <BookmarkCard 
              key={item.id} 
              item={item} 
              onDelete={handleDeleteBookmark} 
            />
          ))
        ) : (
          <EmptyState type="bookmarks" />
        );

      default:
        return null;
    }
  };

  return (
    <div className={`bg-app text-text-primary max-w-4xl mx-auto p-4 md:p-6 min-h-screen ${textFontClass}`}>
      <HistoryTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {renderToolbar()}

      {tabViewState === 'loading' ? (
        <div
          className="space-y-4 mt-4 animate-pulse"
          role="status"
          aria-label={t('history.loading')}
        >
          {[1, 2, 3].map((i) => (
            <div 
              key={i} 
              className="bg-surface border border-border-color h-24 rounded-xl"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4 mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {renderTabContent()}
        </div>
      )}

      <DeleteModal 
        isOpen={deleteModal.isOpen} 
        onClose={handleCloseModal}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default History;
