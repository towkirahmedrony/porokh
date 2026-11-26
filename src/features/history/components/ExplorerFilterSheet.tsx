import React, { memo, useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

import {
  SettingsBottomSheet,
  SheetRadioRow,
} from '@/features/profile/components/SettingsBottomSheet';
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
import { useExplorerDraftCount, useExplorerDraftFacets } from '../hooks/useExplorer';

interface Props {
  open: boolean;
  source: ExplorerSource;
  facets: FacetMap;
  filters: ExplorerFilters;
  sort: ExplorerSort;
  onClose: () => void;
  onApply: (filters: ExplorerFilters, sort: ExplorerSort) => void;
  onOpenDismissed: () => void;
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

const FacetSection: React.FC<{
  title: string;
  open: boolean;
  onToggle: () => void;
  summary: string;
  options: FacetOption[];
  selected: string | undefined;
  language: AppLanguage;
  getLabel?: (option: FacetOption) => string;
  onSelect: (id: string) => void;
}> = ({ title, open, onToggle, summary, options, selected, language, getLabel, onSelect }) => {
  if (options.length === 0) return null;

  return (
    <div className="border-t border-border-color">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-[52px] w-full items-center gap-3 px-5 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold leading-6 text-text-primary">{title}</span>
          <span className="block truncate text-[11px] leading-5 text-text-secondary">
            {summary}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-text-secondary transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="pb-2" role="group" aria-label={title}>
          {options.map((option) => {
            const isSelected = selected === option.id;
            const label = getLabel ? getLabel(option) : facetLabel(option, language);

            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(option.id)}
                className={`flex min-h-[44px] w-full items-center gap-3 px-5 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                  isSelected ? 'bg-surface-elevated' : ''
                }`}
              >
                <span
                  className={`min-w-0 flex-1 truncate text-[13px] leading-6 ${
                    isSelected ? 'font-semibold text-text-primary' : 'text-text-primary'
                  }`}
                >
                  {label}
                </span>
                {isSelected ? (
                  <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                ) : null}
                <span className="shrink-0 text-[11px] tabular-nums leading-5 text-text-secondary">
                  {localizeDigits(option.count, language)}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

/**
 * The filter sheet keeps the list at full height: it opens over the page, holds
 * a draft while the student explores the facets, and applies once. The apply
 * button carries the live count from the same SQL pool, so the number matches
 * what the list will show.
 */
export const ExplorerFilterSheet: React.FC<Props> = memo(
  ({ open, source, facets, filters, sort, onClose, onApply, onOpenDismissed }) => {
    const { language, t } = useLanguage();
    const [draft, setDraft] = useState<ExplorerFilters>(filters);
    const [draftSort, setDraftSort] = useState<ExplorerSort>(sort);
    const [expanded, setExpanded] = useState<string | null>(null);

    useEffect(() => {
      if (!open) return;
      setDraft(filters);
      setDraftSort(sort);
      setExpanded(
        filters.chapter ? 'chapter' : filters.topic ? 'topic' : filters.subject ? 'subject' : null
      );
    }, [open, filters, sort]);

    const countQuery = useExplorerDraftCount(source, draft, open);
    const liveCount = countQuery.data ?? 0;

    // Counts follow the draft: picking a subject narrows the chapter, topic and
    // year numbers before the student applies anything.
    const draftFacetsQuery = useExplorerDraftFacets(source, draft, open);
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
      return draft.subject ? list.filter((option) => option.parent_id === draft.subject) : list;
    }, [liveFacets.chapter, draft.subject]);

    const topics = useMemo(() => {
      const list = liveFacets.topic ?? [];
      if (draft.chapter) return list.filter((option) => option.parent_id === draft.chapter);
      if (draft.subject) {
        const chapterIds = new Set(chapters.map((chapter) => chapter.id));
        return list.filter((option) => option.parent_id && chapterIds.has(option.parent_id));
      }
      return list;
    }, [liveFacets.topic, draft.chapter, draft.subject, chapters]);

    const summaryFor = (key: keyof ExplorerFilters, options: FacetOption[]) => {
      const value = draft[key];
      if (!value) return t('history.explorerAny');
      const found = options.find((option) => option.id === value);
      return found ? facetLabel(found, language) : t('history.explorerAny');
    };

    const toggleValue = (key: keyof ExplorerFilters, id: string) => {
      setDraft((current) => {
        const next = { ...current };
        const isSame = current[key] === id;
        if (isSame) {
          delete next[key];
        } else {
          (next as Record<string, unknown>)[key] = id;
        }

        // Cascading: a new parent makes the old child invalid.
        if (key === 'subject') {
          delete next.chapter;
          delete next.topic;
        }
        if (key === 'chapter') delete next.topic;

        return next;
      });
    };

    const handleReset = () => {
      setDraft({});
      setDraftSort('recent');
      setExpanded(null);
    };

    const handleApply = () => {
      onApply(draft, draftSort);
      onClose();
    };

    const statusOptions: FacetOption[] =
      source === 'mistakes'
        ? (liveFacets.status ?? []).map((option) => ({
            ...option,
            label_bn:
              option.id === 'wrong'
                ? t('history.mistakeWrongBadge')
                : t('history.mistakeSkippedBadge'),
            label_en:
              option.id === 'wrong'
                ? t('history.mistakeWrongBadge')
                : t('history.mistakeSkippedBadge'),
          }))
        : [];

    const hasAnyFacet =
      (liveFacets.subject?.length ?? 0) > 0 ||
      (liveFacets.institution?.length ?? 0) > 0 ||
      (liveFacets.exam_year?.length ?? 0) > 0;

    return (
      <SettingsBottomSheet open={open} title={t('history.explorerFilterTitle')} onClose={onClose}>
        <div className="pb-2" role="radiogroup" aria-label={t('history.explorerSortTitle')}>
          <p className="px-5 pb-1 pt-2 text-[11px] font-semibold leading-5 text-text-secondary">
            {t('history.explorerSortTitle')}
          </p>
          {SORT_KEYS.map((option) => (
            <SheetRadioRow
              key={option.value}
              checked={draftSort === option.value}
              onSelect={() => setDraftSort(option.value)}
              label={t(option.labelKey)}
            />
          ))}
        </div>

        {hasAnyFacet ? (
          <>
            <FacetSection
              title={t('history.explorerFacetSubject')}
              open={expanded === 'subject'}
              onToggle={() => setExpanded(expanded === 'subject' ? null : 'subject')}
              summary={summaryFor('subject', liveFacets.subject ?? [])}
              options={liveFacets.subject ?? []}
              selected={draft.subject}
              language={language}
              onSelect={(id) => toggleValue('subject', id)}
            />

            <FacetSection
              title={t('history.explorerFacetChapter')}
              open={expanded === 'chapter'}
              onToggle={() => setExpanded(expanded === 'chapter' ? null : 'chapter')}
              summary={summaryFor('chapter', chapters)}
              options={chapters}
              selected={draft.chapter}
              language={language}
              onSelect={(id) => toggleValue('chapter', id)}
            />

            <FacetSection
              title={t('history.explorerFacetTopic')}
              open={expanded === 'topic'}
              onToggle={() => setExpanded(expanded === 'topic' ? null : 'topic')}
              summary={summaryFor('topic', topics)}
              options={topics}
              selected={draft.topic}
              language={language}
              onSelect={(id) => toggleValue('topic', id)}
            />

            <FacetSection
              title={t('history.explorerFacetInstitution')}
              open={expanded === 'institution'}
              onToggle={() => setExpanded(expanded === 'institution' ? null : 'institution')}
              summary={summaryFor('institution', liveFacets.institution ?? [])}
              options={liveFacets.institution ?? []}
              selected={draft.institution}
              language={language}
              onSelect={(id) => toggleValue('institution', id)}
            />

            <FacetSection
              title={t('history.explorerFacetYear')}
              open={expanded === 'exam_year'}
              onToggle={() => setExpanded(expanded === 'exam_year' ? null : 'exam_year')}
              summary={summaryFor('exam_year', liveFacets.exam_year ?? [])}
              options={liveFacets.exam_year ?? []}
              selected={draft.exam_year}
              language={language}
              getLabel={(option) => localizeDigits(option.id, language)}
              onSelect={(id) => toggleValue('exam_year', id)}
            />
          </>
        ) : null}

        <div className="border-t border-border-color px-5 pb-2 pt-3">
          <p className="pb-2 text-[11px] font-semibold leading-5 text-text-secondary">
            {t('history.explorerFacetStatus')}
          </p>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((option) => {
              const selected = draft.status === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    setDraft((current) => {
                      const next = { ...current };
                      if (current.status === option.id) {
                        delete next.status;
                      } else {
                        next.status = option.id as ExplorerFilters['status'];
                      }
                      return next;
                    })
                  }
                  className={`flex min-h-[44px] items-center gap-2 rounded-xl border px-4 text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                    selected
                      ? 'border-primary bg-surface-elevated font-semibold text-text-primary'
                      : 'border-border-color bg-surface text-text-primary'
                  }`}
                >
                  {selected ? <Check className="h-4 w-4 text-primary" aria-hidden="true" /> : null}
                  {facetLabel(option, language)}
                  <span className="text-[11px] tabular-nums text-text-secondary">
                    {localizeDigits(option.count, language)}
                  </span>
                </button>
              );
            })}

            {source === 'bookmarks' ? (
              <button
                type="button"
                aria-pressed={draft.has_note === true}
                onClick={() =>
                  setDraft((current) => {
                    const next = { ...current };
                    if (current.has_note) {
                      delete next.has_note;
                    } else {
                      next.has_note = true;
                    }
                    return next;
                  })
                }
                className={`flex min-h-[44px] items-center gap-2 rounded-xl border px-4 text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                  draft.has_note
                    ? 'border-primary bg-surface-elevated font-semibold text-text-primary'
                    : 'border-border-color bg-surface text-text-primary'
                }`}
              >
                {draft.has_note ? <Check className="h-4 w-4 text-primary" aria-hidden="true" /> : null}
                {t('history.explorerNoteChip')}
              </button>
            ) : null}
          </div>
        </div>

        {source === 'mistakes' ? (
          <div className="border-t border-border-color">
            <button
              type="button"
              onClick={onOpenDismissed}
              className="min-h-[48px] w-full px-5 text-left text-[13px] font-semibold text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {t('history.explorerDismissedLink')}
            </button>
          </div>
        ) : null}

        <div className="sticky bottom-0 flex gap-2 border-t border-border-color bg-card-bg px-5 py-3">
          <button
            type="button"
            onClick={handleReset}
            className="min-h-[44px] shrink-0 rounded-xl border border-border-color px-4 text-[13px] font-semibold text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {t('history.explorerReset')}
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="min-h-[44px] min-w-0 flex-1 rounded-xl bg-primary px-4 text-[13px] font-bold text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {countQuery.isLoading
              ? t('history.explorerCounting')
              : t('history.explorerShowCount', {
                  count: localizeDigits(liveCount, language),
                })}
          </button>
        </div>
      </SettingsBottomSheet>
    );
  }
);

ExplorerFilterSheet.displayName = 'ExplorerFilterSheet';
