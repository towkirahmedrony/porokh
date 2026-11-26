import React, { memo, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';

import ConfirmModal from '@/shared/components/feedback/ConfirmModal';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import type { AppLanguage } from '@/shared/i18n/messages';
import { formatCount } from '@/shared/lib/attemptFormat';
import { resolvePracticeError } from '@/features/practice/services/practiceService';
import type {
  ExplorerFilters,
  ExplorerSource,
  FacetMap,
  FacetOption,
} from '../types/explorer';
import explorerService from '../services/explorerService';
import { useExplorerDraftCount } from '../hooks/useExplorer';
import { SettingsBottomSheet } from '@/features/profile/components/SettingsBottomSheet';

interface Props {
  open: boolean;
  source: ExplorerSource;
  facets: FacetMap;
  filters: ExplorerFilters;
  onClose: () => void;
}

type Scope = 'random' | 'filters' | 'subject' | 'chapter' | 'topic' | 'institution';

const FACET_BY_SCOPE: Partial<Record<Scope, keyof ExplorerFilters>> = {
  subject: 'subject',
  chapter: 'chapter',
  topic: 'topic',
  institution: 'institution',
};

const facetLabel = (option: FacetOption, language: AppLanguage): string =>
  (language === 'bn' ? option.label_bn || option.label_en : option.label_en || option.label_bn) ||
  option.id;

const countChips = (available: number): number[] => {
  const presets = [5, 10, 20, 30].filter((value) => value <= available);
  return Array.from(new Set(presets));
};

/**
 * Practice starts the existing quiz-style mistake attempt: one question at a
 * time, instant answer plus explanation, and a correct answer leaves the pool.
 * This sheet only decides which pool to draw from and how many questions; the
 * quota, XP and leaderboard rules stay in the start flow.
 */
export const ExplorerPracticeSheet: React.FC<Props> = memo(
  ({ open, source, facets, filters, onClose }) => {
    const { language, t } = useLanguage();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [scope, setScope] = useState<Scope>('filters');
    const [facetChoice, setFacetChoice] = useState<string | null>(null);
    const [count, setCount] = useState<number | 'all'>('all');
    const [confirmReduced, setConfirmReduced] = useState<{ available: number } | null>(null);

    const hasFilters = Object.keys(filters).length > 0;

    const effectiveFilters = useMemo<ExplorerFilters>(() => {
      if (scope === 'random') return {};
      if (scope === 'filters') return filters;

      const key = FACET_BY_SCOPE[scope];
      if (!key || !facetChoice) return {};
      return { [key]: facetChoice } as ExplorerFilters;
    }, [scope, filters, facetChoice]);

    const countQuery = useExplorerDraftCount(source, effectiveFilters, open);
    const available = countQuery.data ?? 0;

    useEffect(() => {
      if (!open) return;
      setScope(hasFilters ? 'filters' : 'random');
      setFacetChoice(null);
      setConfirmReduced(null);
    }, [open, hasFilters]);

    useEffect(() => {
      if (countQuery.isLoading) return;
      const presets = countChips(available);
      if (count === 'all') return;
      if (count > available) {
        setCount(available > 0 ? (presets[presets.length - 1] ?? 'all') : 'all');
      }
    }, [available, count, countQuery.isLoading]);

    const requestedCount =
      count === 'all' ? Math.max(1, available) : Math.min(count, available);

    const startMutation = useMutation({
      mutationFn: (allowReduced: boolean) =>
        explorerService.startPractice({
          source,
          filters: effectiveFilters,
          count: requestedCount,
          confirmReduced: allowReduced,
        }),
      onSuccess: (result) => {
        if (result.started && result.attempt?.id) {
          queryClient.invalidateQueries({ queryKey: ['history-explorer'] });
          onClose();
          navigate(`/exam/attempt/${result.attempt.id}`);
          return;
        }

        if (result.reason === 'confirm_reduced') {
          setConfirmReduced({ available: result.available_count });
          return;
        }

        toast.error(
          source === 'bookmarks'
            ? t('history.explorerPracticeEmptyBookmarks')
            : t('history.explorerPracticeEmpty')
        );
      },
      onError: (error) => {
        toast.error(resolvePracticeError(error, t('practice.startFailed')));
      },
    });

    const scopeRows: { value: Scope; label: string; count?: number; disabled?: boolean }[] = [
      {
        value: 'random',
        label:
          source === 'bookmarks'
            ? t('history.explorerScopeAllBookmarks')
            : t('history.explorerScopeAll'),
      },
      {
        value: 'filters',
        label: t('history.explorerScopeFilters'),
        disabled: !hasFilters,
      },
      {
        value: 'subject',
        label: t('history.explorerFacetSubject'),
        count: (facets.subject ?? []).length,
      },
      {
        value: 'chapter',
        label: t('history.explorerFacetChapter'),
        count: (facets.chapter ?? []).length,
      },
      {
        value: 'topic',
        label: t('history.explorerFacetTopic'),
        count: (facets.topic ?? []).length,
      },
      {
        value: 'institution',
        label: t('history.explorerFacetInstitution'),
        count: (facets.institution ?? []).length,
      },
    ];

    const facetOptions: FacetOption[] =
      scope === 'filters' || scope === 'random'
        ? []
        : (facets[scope as 'subject' | 'chapter' | 'topic' | 'institution'] ?? []);

    const startDisabled = countQuery.isLoading || available === 0 || startMutation.isPending;

    return (
      <>
        <SettingsBottomSheet
          open={open}
          title={
            source === 'bookmarks'
              ? t('history.explorerPracticeBookmarksTitle')
              : t('history.explorerPracticeTitle')
          }
          onClose={onClose}
        >
          <p className="px-5 pb-2 text-[11px] leading-5 text-text-secondary">
            {t('history.explorerPracticeRule')}
          </p>

          {scope !== 'random' && scope !== 'filters' && facetChoice === null ? (
            <div className="border-t border-border-color" role="radiogroup" aria-label={t('history.explorerPracticeScope')}>
              {facetOptions.length === 0 ? (
                <p className="px-5 py-4 text-[13px] text-text-secondary">
                  {t('history.explorerAny')}
                </p>
              ) : (
                facetOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={false}
                    onClick={() => setFacetChoice(option.id)}
                    className="flex min-h-[48px] w-full items-center gap-3 px-5 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    <span className="min-w-0 flex-1 truncate text-[13px] leading-6 text-text-primary">
                      {facetLabel(option, language)}
                    </span>
                    <span className="text-[11px] tabular-nums text-text-secondary">
                      {localizeDigits(option.count, language)}
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : (
            <>
              <div className="border-t border-border-color pt-2" role="radiogroup" aria-label={t('history.explorerPracticeScope')}>
                {scopeRows.map((row) => {
                  const selected = scope === row.value;
                  return (
                    <button
                      key={row.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={row.disabled}
                      onClick={() => {
                        setScope(row.value);
                        setFacetChoice(null);
                      }}
                      className={`flex min-h-[48px] w-full items-center gap-3 px-5 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                        selected ? 'bg-surface-elevated' : ''
                      }`}
                    >
                      <span
                        className={`min-w-0 flex-1 truncate text-[13px] leading-6 text-text-primary ${
                          selected ? 'font-semibold' : ''
                        } ${row.disabled ? 'opacity-50' : ''}`}
                      >
                        {row.label}
                      </span>
                      {selected ? <Check className="h-4 w-4 text-primary" aria-hidden="true" /> : null}
                      {typeof row.count === 'number' && row.count > 0 ? (
                        <span className="text-[11px] tabular-nums text-text-secondary">
                          {localizeDigits(row.count, language)}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {scope !== 'random' && scope !== 'filters' && facetChoice !== null ? (
                <div className="flex items-center gap-2 border-t border-border-color px-5 py-2">
                  <button
                    type="button"
                    onClick={() => setFacetChoice(null)}
                    className="flex min-h-[36px] items-center gap-1 text-[12px] font-semibold text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    {t('history.explorerPracticeChangeFacet')}
                  </button>
                  <span className="min-w-0 flex-1 truncate text-right text-[12px] text-text-secondary">
                    {facetLabel(
                      facetOptions.find((option) => option.id === facetChoice) ?? {
                        id: facetChoice,
                        parent_id: null,
                        label_bn: null,
                        label_en: null,
                        count: 0,
                      },
                      language
                    )}
                  </span>
                </div>
              ) : null}
            </>
          )}

          <div className="border-t border-border-color px-5 py-3">
            <p className="pb-2 text-[11px] font-semibold leading-5 text-text-secondary">
              {t('history.explorerPracticeCount')}
            </p>
            <div className="flex flex-wrap gap-2">
              {countChips(available).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={count === value}
                  onClick={() => setCount(value)}
                  className={`min-h-[44px] min-w-[52px] rounded-xl border px-3 text-[13px] tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                    count === value
                      ? 'border-primary bg-surface-elevated font-bold text-text-primary'
                      : 'border-border-color bg-surface text-text-primary'
                  }`}
                >
                  {formatCount(value, language)}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={count === 'all'}
                onClick={() => setCount('all')}
                disabled={available === 0}
                className={`min-h-[44px] rounded-xl border px-3 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                  count === 'all'
                    ? 'border-primary bg-surface-elevated font-bold text-text-primary'
                    : 'border-border-color bg-surface text-text-primary'
                }`}
              >
                {t('history.explorerPracticeAll')}
              </button>
            </div>

            <p className="pt-2 text-[11px] leading-5 text-text-secondary" aria-live="polite">
              {countQuery.isLoading
                ? t('history.explorerCounting')
                : available === 0
                  ? t('history.explorerPracticeNone')
                  : t('history.explorerPracticeAvailable', {
                      count: formatCount(available, language),
                    })}
            </p>
          </div>

          <div className="border-t border-border-color px-5 py-3">
            <button
              type="button"
              onClick={() => startMutation.mutate(false)}
              disabled={startDisabled}
              className="min-h-[44px] w-full rounded-xl bg-primary px-4 text-[13px] font-bold text-primary-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {startMutation.isPending
                ? t('practice.starting')
                : t('history.explorerPracticeStart', {
                    count: formatCount(requestedCount, language),
                  })}
            </button>
          </div>
        </SettingsBottomSheet>

        <ConfirmModal
          isOpen={confirmReduced !== null}
          title={t('practice.reducedTitle')}
          message={t('practice.reducedMessage', {
            available: formatCount(confirmReduced?.available ?? 0, language),
            requested: formatCount(requestedCount, language),
          })}
          confirmText={t('practice.startAvailable')}
          cancelText={t('common.cancel')}
          onConfirm={() => {
            setConfirmReduced(null);
            startMutation.mutate(true);
          }}
          onCancel={() => setConfirmReduced(null)}
          isLoading={startMutation.isPending}
        />
      </>
    );
  }
);

ExplorerPracticeSheet.displayName = 'ExplorerPracticeSheet';
