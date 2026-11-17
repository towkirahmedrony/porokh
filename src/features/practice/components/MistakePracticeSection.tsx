import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, Target } from 'lucide-react';
import toast from 'react-hot-toast';

import ConfirmModal from '@/shared/components/feedback/ConfirmModal';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import {
  MAX_PRACTICE_QUESTIONS,
  PRACTICE_COUNT_PRESETS,
  parsePracticeCount,
  sanitizeCountInput,
} from '../utils/practice';
import { practiceService, resolvePracticeError } from '../services/practiceService';

type CountSelection = number | 'custom';

interface ReducedConfirm {
  available: number;
  requested: number;
}

export const MistakePracticeSection: React.FC = () => {
  const navigate = useNavigate();
  const { language, t } = useLanguage();

  const [selection, setSelection] = useState<CountSelection>(5);
  const [customValue, setCustomValue] = useState('');
  const [reducedConfirm, setReducedConfirm] = useState<ReducedConfirm | null>(null);

  const poolQuery = useQuery({
    queryKey: ['practice', 'mistakePool'],
    queryFn: practiceService.getMistakePool,
    staleTime: 60_000,
    retry: 1,
  });

  const available = poolQuery.data?.available_count ?? 0;

  const requestedCount = useMemo(() => {
    if (selection === 'custom') return parsePracticeCount(customValue);
    return selection;
  }, [selection, customValue]);

  const startMutation = useMutation({
    mutationFn: ({
      count,
      confirmReduced,
    }: {
      count: number;
      confirmReduced: boolean;
    }) => practiceService.startMistakePractice(count, confirmReduced),
    onSuccess: (result) => {
      if (result.started && result.attempt?.id) {
        navigate(`/exam/attempt/${result.attempt.id}`);
        return;
      }

      if (result.reason === 'confirm_reduced') {
        setReducedConfirm({
          available: result.available_count,
          requested: result.requested_count ?? requestedCount ?? result.available_count,
        });
        return;
      }

      if (result.reason === 'empty') {
        toast.error(t('practice.poolEmptyToast'));
      }
    },
    onError: (error) => {
      toast.error(resolvePracticeError(error, t('practice.startFailed')));
    },
  });

  const handleStart = () => {
    if (requestedCount === null) {
      toast.error(t('practice.invalidCount'));
      return;
    }

    startMutation.mutate({ count: requestedCount, confirmReduced: false });
  };

  const isLoading = poolQuery.isPending;
  const isError = poolQuery.isError;
  const isBusy = startMutation.isPending;
  const tooMany = requestedCount !== null && requestedCount > available && available > 0;

  return (
    <section className="rounded-2xl border border-card-border bg-card-bg p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-badge-bg text-badge-text">
          <Target className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-text-primary">
            {t('practice.poolTitle')}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {t('practice.poolSubtitle')}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-3" role="status" aria-label={t('practice.loadingPool')}>
          <div className="h-4 w-40 animate-pulse rounded bg-surface-elevated" />
          <div className="h-10 w-full animate-pulse rounded-xl bg-surface-elevated" />
          <div className="h-11 w-full animate-pulse rounded-xl bg-surface-elevated" />
        </div>
      ) : isError ? (
        <div className="mt-4 rounded-xl border border-border-color bg-surface p-4">
          <p className="text-sm text-text-secondary">{t('practice.loadFailed')}</p>
          <button
            type="button"
            onClick={() => poolQuery.refetch()}
            className="mt-3 rounded-lg border border-border-color bg-card-bg px-3 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-surface-elevated"
          >
            {t('practice.retry')}
          </button>
        </div>
      ) : available === 0 ? (
        <div className="mt-4 rounded-xl border border-border-color bg-surface p-4">
          <h3 className="text-sm font-bold text-text-primary">
            {t('practice.poolEmptyTitle')}
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            {t('practice.poolEmptyMessage')}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-text-primary">
              {t('practice.availableCount', {
                count: localizeDigits(available, language),
              })}
            </p>
            <p className="text-xs text-text-secondary">
              {t('practice.poolRule')}
            </p>
          </div>

          <div
            role="group"
            aria-label={t('practice.countLabel')}
            className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5"
          >
            {PRACTICE_COUNT_PRESETS.map((preset) => {
              const isActive = selection === preset;

              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setSelection(preset)}
                  aria-pressed={isActive}
                  className={`rounded-xl border px-2 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                    isActive
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border-color bg-surface text-text-primary hover:bg-surface-elevated'
                  }`}
                >
                  {localizeDigits(preset, language)}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setSelection('custom')}
              aria-pressed={selection === 'custom'}
              className={`rounded-xl border px-2 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                selection === 'custom'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border-color bg-surface text-text-primary hover:bg-surface-elevated'
              }`}
            >
              {t('practice.custom')}
            </button>
          </div>

          {selection === 'custom' && (
            <div className="mt-3">
              <label
                htmlFor="practice-custom-count"
                className="mb-1.5 block text-xs font-semibold text-text-secondary"
              >
                {t('practice.customLabel')}
              </label>
              <input
                id="practice-custom-count"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={3}
                value={customValue}
                onChange={(event) =>
                  setCustomValue(sanitizeCountInput(event.target.value))
                }
                placeholder={t('practice.customPlaceholder', {
                  max: localizeDigits(MAX_PRACTICE_QUESTIONS, language),
                })}
                className="w-full rounded-xl border border-border-color bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {requestedCount === null && customValue.length > 0 && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-accent">
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('practice.invalidCount')}
                </p>
              )}
            </div>
          )}

          {tooMany && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-text-secondary">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
              {t('practice.requestedTooMany', {
                requested: localizeDigits(requestedCount ?? 0, language),
                available: localizeDigits(available, language),
              })}
            </p>
          )}

          <button
            type="button"
            onClick={handleStart}
            disabled={isBusy || requestedCount === null}
            className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {isBusy ? t('practice.starting') : t('practice.start')}
          </button>
        </>
      )}

      <ConfirmModal
        isOpen={reducedConfirm !== null}
        title={t('practice.reducedTitle')}
        message={t('practice.reducedMessage', {
          available: localizeDigits(reducedConfirm?.available ?? 0, language),
          requested: localizeDigits(reducedConfirm?.requested ?? 0, language),
        })}
        confirmText={t('practice.startAvailable')}
        cancelText={t('common.cancel')}
        onConfirm={() => {
          if (!reducedConfirm) return;
          const count = reducedConfirm.requested;
          setReducedConfirm(null);
          startMutation.mutate({ count, confirmReduced: true });
        }}
        onCancel={() => setReducedConfirm(null)}
        isLoading={startMutation.isPending}
      />
    </section>
  );
};
