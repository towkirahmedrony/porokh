import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Skeleton } from '@/shared/components/ui/Skeleton';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import type {
  ExplorerFilters,
  ExplorerItem,
  ExplorerSort,
  ExplorerSource,
} from '../types/explorer';
import type { AppLanguage } from '@/shared/i18n/messages';
import {
  useExplorerActions,
  useExplorerFacets,
  useExplorerList,
} from '../hooks/useExplorer';
import { ExplorerCard } from './ExplorerCard';
import { ExplorerToolbar } from './ExplorerToolbar';
import { ExplorerFilterPanel, countActiveFilters } from './ExplorerFilterPanel';
import { ExplorerPracticeSheet } from './ExplorerPracticeSheet';
import { DismissedSheet } from './DismissedSheet';
import { NoteSheet } from './NoteSheet';
import { EmptyState } from './EmptyState';
import { FloatingAnswerButton } from '@/shared/components/filters/FloatingAnswerButton';

interface Props {
  source: ExplorerSource;
}

const scrollListToTop = () => {
  const main = document.querySelector<HTMLElement>('main');
  if (main) main.scrollTop = 0;
};

const useDebouncedValue = <T,>(value: T, delay: number): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
};

const facetLabel = (
  options: { id: string; label_bn: string | null; label_en: string | null }[],
  id: string,
  language: AppLanguage,
  fallback: string
): string => {
  const found = options.find((option) => option.id === id);
  if (!found) return fallback;
  return (
    (language === 'bn'
      ? found.label_bn || found.label_en
      : found.label_en || found.label_bn) || fallback
  );
};

/**
 * The Mistakes and Bookmarks tab. Both use the same card, facets and practice
 * sheet; only the pool and a few labels differ. Answers start hidden on every
 * visit because `revealAll` lives here and resets with the component.
 */
export const ExplorerTab: React.FC<Props> = memo(({ source }) => {
  const { language, t } = useLanguage();

  const [filters, setFilters] = useState<ExplorerFilters>({});
  const [sort, setSort] = useState<ExplorerSort>('recent');
  const [revealAll, setRevealAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [dismissedOpen, setDismissedOpen] = useState(false);
  const [noteTarget, setNoteTarget] = useState<ExplorerItem | null>(null);

  const debouncedQuery = useDebouncedValue(searchQuery.trim(), 300);

  const effectiveFilters = useMemo<ExplorerFilters>(
    () => ({ ...filters, ...(debouncedQuery ? { q: debouncedQuery } : {}) }),
    [filters, debouncedQuery]
  );

  const list = useExplorerList(source, effectiveFilters, sort, true);
  const { facets } = useExplorerFacets(source, true);
  const actions = useExplorerActions(source);

  // Search now lives inside the panel, so it belongs in the badge count too.
  const filterCount =
    countActiveFilters(effectiveFilters) + (debouncedQuery ? 1 : 0);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!list.hasMore || list.isFetchingNextPage) return;

    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void list.loadMore();
        }
      },
      { rootMargin: '320px 0px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [list.hasMore, list.isFetchingNextPage, list.loadMore, list.items.length]);

  const scrollFiltersToTop = useCallback(() => {
    scrollListToTop();
  }, []);

  const handleFiltersChange = useCallback(
    (next: ExplorerFilters) => {
      setFilters(next);
      scrollFiltersToTop();
    },
    [scrollFiltersToTop]
  );

  const handleRemoveChip = useCallback(
    (key: keyof ExplorerFilters) => {
      scrollFiltersToTop();
      setFilters((current) => {
        const next = { ...current };
        delete next[key];
        if (key === 'subject') {
          delete next.chapter;
          delete next.topic;
        }
        if (key === 'chapter') delete next.topic;
        return next;
      });
    },
    [scrollFiltersToTop]
  );

  const handleResetAll = useCallback(() => {
    setFilters({});
    setSort('recent');
    setSearchQuery('');
    scrollFiltersToTop();
  }, [scrollFiltersToTop]);

  const activeChips = useMemo(() => {
    const chips: { key: keyof ExplorerFilters; label: string }[] = [];

    if (effectiveFilters.subject) {
      chips.push({
        key: 'subject',
        label: facetLabel(facets.subject ?? [], effectiveFilters.subject, language, effectiveFilters.subject),
      });
    }
    if (effectiveFilters.chapter) {
      chips.push({
        key: 'chapter',
        label: facetLabel(facets.chapter ?? [], effectiveFilters.chapter, language, effectiveFilters.chapter),
      });
    }
    if (effectiveFilters.topic) {
      chips.push({
        key: 'topic',
        label: facetLabel(facets.topic ?? [], effectiveFilters.topic, language, effectiveFilters.topic),
      });
    }
    if (effectiveFilters.institution) {
      chips.push({
        key: 'institution',
        label: facetLabel(
          facets.institution ?? [],
          effectiveFilters.institution,
          language,
          effectiveFilters.institution
        ),
      });
    }
    if (effectiveFilters.exam_year) {
      chips.push({ key: 'exam_year', label: effectiveFilters.exam_year });
    }
    if (effectiveFilters.status) {
      chips.push({
        key: 'status',
        label:
          effectiveFilters.status === 'wrong'
            ? t('history.mistakeWrongBadge')
            : t('history.mistakeSkippedBadge'),
      });
    }
    if (effectiveFilters.has_note) {
      chips.push({ key: 'has_note', label: t('history.explorerNoteChip') });
    }

    return chips;
  }, [effectiveFilters, facets, language, t]);

  const hasAnyNarrowing = filterCount > 0 || debouncedQuery.length > 0;
  const isEmptyPool = !list.isLoading && list.total === 0 && !hasAnyNarrowing;

  const renderBody = () => {
    if (list.isLoading) {
      return (
        <div className="space-y-3" role="status" aria-label={t('history.loading')}>
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="rounded-[16px] border border-card-border bg-card-bg p-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="mt-3 h-3.5 w-full" />
              <Skeleton className="mt-2 h-3.5 w-4/5" />
              <Skeleton className="mt-3 h-10 w-full rounded-xl" />
              <Skeleton className="mt-2 h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
      );
    }

    if (list.isError) {
      return (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-[16px] bg-card-bg px-5 py-10 text-center">
          <h3 className="text-[15px] font-bold text-text-primary">{t('history.errorTitle')}</h3>
          <p className="text-[13px] leading-6 text-text-secondary">{t('history.errorMessage')}</p>
          <button
            type="button"
            onClick={() => void list.refetch()}
            className="min-h-[44px] rounded-xl bg-primary px-6 text-[13px] font-bold text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {t('history.retry')}
          </button>
        </div>
      );
    }

    if (isEmptyPool) {
      return <EmptyState type={source} />;
    }

    if (list.total === 0) {
      return (
        <div className="flex flex-col items-center gap-3 rounded-[16px] bg-card-bg px-5 py-10 text-center">
          <h3 className="text-[15px] font-bold text-text-primary">
            {t('history.explorerNoMatchesTitle')}
          </h3>
          <p className="text-[13px] leading-6 text-text-secondary">
            {t('history.explorerNoMatchesMessage')}
          </p>
          <button
            type="button"
            onClick={handleResetAll}
            className="min-h-[44px] rounded-xl bg-primary px-6 text-[13px] font-bold text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {t('history.explorerResetFilters')}
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {list.items.map((item, index) => (
          <ExplorerCard
            key={item.id}
            item={item}
            source={source}
            revealAll={revealAll}
            onRemove={() => actions.remove(item, index)}
            onEditNote={
              source === 'bookmarks'
                ? () => setNoteTarget(item)
                : undefined
            }
          />
        ))}

        {list.isFetchingNextPage ? (
          <div className="space-y-2" role="status" aria-label={t('history.loading')}>
            <Skeleton className="h-16 w-full rounded-[16px]" />
          </div>
        ) : null}

        {list.hasMore ? <div ref={sentinelRef} className="h-10" aria-hidden="true" /> : null}
      </div>
    );
  };

  return (
    <div className="space-y-3 pb-16">
      <ExplorerToolbar
        count={list.total}
        showCount={!list.isLoading && !list.isError}
        filterCount={filterCount}
        isOpen={filterPanelOpen}
        onToggleFilters={() => setFilterPanelOpen((value) => !value)}
      />

      {filterPanelOpen ? (
        <ExplorerFilterPanel
          source={source}
          facets={facets}
          filters={filters}
          sort={sort}
          searchValue={searchQuery}
          activeChips={activeChips}
          onSearchChange={setSearchQuery}
          onChange={handleFiltersChange}
          onSortChange={(nextSort) => {
            setSort(nextSort);
            scrollFiltersToTop();
          }}
          onRemoveChip={handleRemoveChip}
          onReset={handleResetAll}
          onOpenDismissed={() => {
            setFilterPanelOpen(false);
            setDismissedOpen(true);
          }}
          onOpenPractice={() => setPracticeOpen(true)}
        />
      ) : null}

      <div className="animate-in fade-in duration-200 motion-reduce:animate-none">
        {renderBody()}
      </div>

      {!list.isLoading && !list.isError && list.items.length > 0 ? (
        <FloatingAnswerButton
          revealed={revealAll}
          onToggle={() => setRevealAll((value) => !value)}
        />
      ) : null}

      <ExplorerPracticeSheet
        open={practiceOpen}
        source={source}
        facets={facets}
        filters={effectiveFilters}
        onClose={() => setPracticeOpen(false)}
      />

      <DismissedSheet open={dismissedOpen} onClose={() => setDismissedOpen(false)} />

      <NoteSheet
        open={noteTarget !== null}
        initialNote={noteTarget?.note ?? ''}
        isSaving={actions.isSavingNote}
        onClose={() => setNoteTarget(null)}
        onSave={async (note) => {
          if (!noteTarget?.item_id) return;
          try {
            await actions.saveNote({ bookmarkId: noteTarget.item_id, note });
            setNoteTarget(null);
          } catch {
            // The hook already showed the failure toast.
          }
        }}
      />
    </div>
  );
});

ExplorerTab.displayName = 'ExplorerTab';
