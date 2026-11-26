import React, { memo, useMemo } from 'react';
import { Check, X } from 'lucide-react';

import { useLanguage } from '@/shared/i18n/LanguageProvider';
import type { AppLanguage, AppMessageKey } from '@/shared/i18n/messages';
import { localizeDigits } from '@/shared/i18n/messages';
import type {
  ExplorerFilters,
  ExplorerSort,
  ExplorerSource,
  FacetMap,
  FacetOption,
} from '../types/explorer';
import { useExplorerDraftFacets } from '../hooks/useExplorer';
import { FilterPanel, FilterSelect, type FilterOption } from '@/shared/components/filters/FilterPanel';

interface Props {
  source: ExplorerSource;
  facets: FacetMap;
  filters: ExplorerFilters;
  sort: ExplorerSort;
  searchValue: string;
  activeChips: { key: keyof ExplorerFilters; label: string }[];
  onSearchChange: (value: string) => void;
  onChange: (next: ExplorerFilters) => void;
  onSortChange: (sort: ExplorerSort) => void;
  onRemoveChip: (key: keyof ExplorerFilters) => void;
  onReset: () => void;
  onOpenDismissed: () => void;
  onOpenPractice: () => void;
}

const SORT_KEYS: { value: ExplorerSort; labelKey: AppMessageKey }[] = [
  { value: 'recent', labelKey: 'history.explorerSortRecent' },
  { value: 'most_wrong', labelKey: 'history.explorerSortMostWrong' },
  { value: 'subject', labelKey: 'history.explorerSortSubject' },
];

const facetLabel = (option: FacetOption, language: AppLanguage): string =>
  (language === 'bn' ? option.label_bn || option.label_en : option.label_en || option.label_bn) ||
  option.id;

export const countActiveFilters = (filters: ExplorerFilters): number =>
  [
    filters.subject,
    filters.chapter,
    filters.topic,
    filters.institution,
    filters.exam_year,
    filters.status,
    filters.has_note ? 'note' : undefined,
  ].filter((value) => value !== undefined && value !== '').length;

/**
 * The Mistakes/Bookmarks filter panel. It replaces the old bottom sheet with an
 * inline card, exactly where the Question Bank keeps its filters, and applies
 * every change immediately. Subject narrows chapter and topic, chapter narrows
 * topic, and the option counts follow the current selection.
 */
export const ExplorerFilterPanel: React.FC<Props> = memo(
  ({
    source,
    facets,
    filters,
    sort,
    searchValue,
    activeChips,
    onSearchChange,
    onChange,
    onSortChange,
    onRemoveChip,
    onReset,
    onOpenDismissed,
    onOpenPractice,
  }) => {
    const { language, t } = useLanguage();

    const draftFacetsQuery = useExplorerDraftFacets(source, filters, true);
    const liveFacets = useMemo<FacetMap>(() => {
      const merged: FacetMap = { ...facets };
      (Object.keys(draftFacetsQuery.facets) as (keyof FacetMap)[]).forEach((key) => {
        const options = draftFacetsQuery.facets[key];
        if (options && options.length > 0) merged[key] = options;
      });
      return merged;
    }, [facets, draftFacetsQuery.facets]);

    const chapters = useMemo(() => {
      const list = liveFacets.chapter ?? [];
      return filters.subject
        ? list.filter((option) => option.parent_id === filters.subject)
        : list;
    }, [liveFacets.chapter, filters.subject]);

    const topics = useMemo(() => {
      const list = liveFacets.topic ?? [];
      if (filters.chapter) return list.filter((option) => option.parent_id === filters.chapter);
      if (filters.subject) {
        const chapterIds = new Set(chapters.map((chapter) => chapter.id));
        return list.filter((option) => option.parent_id && chapterIds.has(option.parent_id));
      }
      return list;
    }, [liveFacets.topic, filters.chapter, filters.subject, chapters]);

    const toOptions = (
      options: FacetOption[],
      getLabel?: (option: FacetOption) => string
    ): FilterOption[] => [
      { value: '', label: t('history.explorerAny') },
      ...options.map((option) => ({
        value: option.id,
        label: getLabel ? getLabel(option) : facetLabel(option, language),
      })),
    ];

    const setFilter = (key: keyof ExplorerFilters, value: string) => {
      const next: ExplorerFilters = { ...filters };
      if (value) {
        (next as Record<string, unknown>)[key] = value;
      } else {
        delete next[key];
      }

      if (key === 'subject') {
        delete next.chapter;
        delete next.topic;
      }
      if (key === 'chapter') delete next.topic;

      onChange(next);
    };

    const statusOptions = source === 'mistakes' ? liveFacets.status ?? [] : [];
    const hasSubject = (liveFacets.subject?.length ?? 0) > 0;
    const hasChapter = chapters.length > 0;
    const hasTopic = topics.length > 0;
    const hasInstitution = (liveFacets.institution?.length ?? 0) > 0;
    const hasYear = (liveFacets.exam_year?.length ?? 0) > 0;

    const extra = (
      <>
        {statusOptions.length > 0 || source === 'bookmarks' ? (
          <div className="space-y-2 border-t border-border-color pt-4">
            <p className="text-[11px] font-semibold leading-5 text-text-secondary">
              {t('history.explorerFacetStatus')}
            </p>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((option) => {
                const selected = filters.status === option.id;
                const label =
                  option.id === 'wrong'
                    ? t('history.mistakeWrongBadge')
                    : t('history.mistakeSkippedBadge');

                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      const next: ExplorerFilters = { ...filters };
                      if (selected) {
                        delete next.status;
                      } else {
                        next.status = option.id as ExplorerFilters['status'];
                      }
                      onChange(next);
                    }}
                    className={`flex min-h-[44px] items-center gap-2 rounded-xl border px-4 text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                      selected
                        ? 'border-primary bg-surface-elevated font-semibold text-text-primary'
                        : 'border-border-color bg-surface text-text-primary'
                    }`}
                  >
                    {selected ? (
                      <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                    ) : null}
                    {label}
                    <span className="text-[11px] tabular-nums text-text-secondary">
                      {localizeDigits(option.count, language)}
                    </span>
                  </button>
                );
              })}

              {source === 'bookmarks' ? (
                <button
                  type="button"
                  aria-pressed={filters.has_note === true}
                  onClick={() => {
                    const next: ExplorerFilters = { ...filters };
                    if (next.has_note) {
                      delete next.has_note;
                    } else {
                      next.has_note = true;
                    }
                    onChange(next);
                  }}
                  className={`flex min-h-[44px] items-center gap-2 rounded-xl border px-4 text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                    filters.has_note
                      ? 'border-primary bg-surface-elevated font-semibold text-text-primary'
                      : 'border-border-color bg-surface text-text-primary'
                  }`}
                >
                  {filters.has_note ? (
                    <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                  ) : null}
                  {t('history.explorerNoteChip')}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {activeChips.length > 0 ? (
          <div className="space-y-2 border-t border-border-color pt-4">
            <p className="text-[11px] font-semibold leading-5 text-text-secondary">
              {t('history.explorerActiveFilters')}
            </p>
            <div className="flex flex-wrap gap-2">
              {activeChips.map((chip) => (
                <span
                  key={chip.key}
                  className="flex min-w-0 items-center gap-1 rounded-lg border border-border-color bg-card-bg py-1 pl-2.5 pr-1 text-[11px] leading-5 text-text-primary"
                >
                  <span className="min-w-0 break-words">{chip.label}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveChip(chip.key)}
                    aria-label={t('history.explorerRemoveFilter', { label: chip.label })}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </>
    );

    const footer = (
      <>
        <div className="mt-4 space-y-1 border-t border-border-color pt-2">
          <button
            type="button"
            onClick={onOpenPractice}
            aria-haspopup="dialog"
            className="min-h-[48px] w-full text-left text-[13px] font-semibold text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {source === 'mistakes'
              ? t('history.explorerPracticeTitle')
              : t('history.explorerPracticeBookmarksTitle')}
          </button>

          {source === 'mistakes' ? (
            <button
              type="button"
              onClick={onOpenDismissed}
              className="min-h-[48px] w-full text-left text-[13px] font-semibold text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {t('history.explorerDismissedLink')}
            </button>
          ) : null}
        </div>
      </>
    );

    return (
      <FilterPanel
        id="explorer-filters"
        title={t('history.explorerFilterTitle')}
        resetLabel={t('history.explorerReset')}
        onReset={onReset}
        search={{
          value: searchValue,
          onChange: onSearchChange,
          label: t('history.explorerSearchLabel'),
          placeholder: t('history.explorerSearchPlaceholder'),
        }}
        extra={extra}
        footer={footer}
      >
        {hasSubject ? (
          <FilterSelect
            label={t('history.explorerFacetSubject')}
            value={filters.subject ?? ''}
            onChange={(value) => setFilter('subject', value)}
            options={toOptions(liveFacets.subject ?? [])}
          />
        ) : null}

        {hasChapter ? (
          <FilterSelect
            label={t('history.explorerFacetChapter')}
            value={filters.chapter ?? ''}
            onChange={(value) => setFilter('chapter', value)}
            options={toOptions(chapters)}
          />
        ) : null}

        {hasTopic ? (
          <FilterSelect
            label={t('history.explorerFacetTopic')}
            value={filters.topic ?? ''}
            onChange={(value) => setFilter('topic', value)}
            options={toOptions(topics)}
          />
        ) : null}

        {hasInstitution ? (
          <FilterSelect
            label={t('history.explorerFacetInstitution')}
            value={filters.institution ?? ''}
            onChange={(value) => setFilter('institution', value)}
            options={toOptions(liveFacets.institution ?? [])}
          />
        ) : null}

        {hasYear ? (
          <FilterSelect
            label={t('history.explorerFacetYear')}
            value={filters.exam_year ?? ''}
            onChange={(value) => setFilter('exam_year', value)}
            options={toOptions(liveFacets.exam_year ?? [], (option) =>
              localizeDigits(option.id, language)
            )}
          />
        ) : null}

        <FilterSelect
          label={t('history.explorerSortTitle')}
          value={sort}
          onChange={(value) => onSortChange(value as ExplorerSort)}
          options={SORT_KEYS.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
          }))}
          searchThreshold={99}
        />
      </FilterPanel>
    );
  }
);

ExplorerFilterPanel.displayName = 'ExplorerFilterPanel';

export default ExplorerFilterPanel;
