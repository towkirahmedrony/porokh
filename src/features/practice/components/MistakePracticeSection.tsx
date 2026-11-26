import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
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

interface MistakePracticeSectionProps {
  /**
   * Number of mistake questions the dashboard already counted. Passing it in
   * keeps the page to a single read; the start call re-checks the pool server
   * side and answers with `confirm_reduced` when it shrank.
   */
  availableCount: number;
}

export const MistakePracticeSection: React.FC<MistakePracticeSectionProps> = ({
  availableCount,
}) => {
  const navigate = useNavigate();
  const { language, t } = useLanguage();

  const [selection, setSelection] = useState<CountSelection>(5);
  const [customValue, setCustomValue] = useState('');
  const [reducedConfirm, setReducedConfirm] = useState<ReducedConfirm | null>(null);

  const available = Math.max(0, Math.trunc(availableCount));

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

  const isBusy = startMutation.isPending;
  const tooMany = requestedCount !== null && requestedCount > available && available > 0;

  return (
    <section className="rounded-[20px] bg-card-bg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold leading-6 text-text-primary">
            {t('progress.mistakesTitle')}
          </h2>
          <p className="mt-0.5 text-[11px] leading-4 text-text-secondary">
            {t('progress.mistakesSubtitle')}
          </p>
        </div>
        {available > 0 ? (
          <span className="shrink-0 rounded-md bg-badge-bg px-2 py-1 text-[11px] font-bold leading-4 text-badge-text">
            {t('progress.mistakesAvailable', {
              count: localizeDigits(available, language),
            })}
          </span>
        ) : null}
      </div>

      {available === 0 ? (
        <div className="mt-3 rounded-xl bg-secondary px-3 py-4">
          <p className="text-[13px] font-semibold text-text-primary">
            {t('practice.poolEmptyTitle')}
          </p>
          <p className="mt-1 text-[12px] leading-5 text-text-secondary">
            {t('practice.poolEmptyMessage')}
          </p>
        </div>
      ) : (
        <>
          <div
            role="group"
            aria-label={t('practice.countLabel')}
            className="mt-3 grid grid-cols-5 gap-1.5"
          >
            {PRACTICE_COUNT_PRESETS.map((preset) => {
              const isActive = selection === preset;

              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setSelection(preset)}
                  aria-pressed={isActive}
                  className={`h-11 rounded-xl text-[12px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-text-primary'
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
              className={`h-11 rounded-xl text-[12px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                selection === 'custom'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-text-primary'
              }`}
            >
              {t('practice.custom')}
            </button>
          </div>

          {selection === 'custom' ? (
            <div className="mt-2.5">
              <label
                htmlFor="practice-custom-count"
                className="mb-1 block text-[11px] font-semibold text-text-secondary"
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
                className="h-11 w-full rounded-xl bg-secondary px-3 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              />
              {requestedCount === null && customValue.length > 0 ? (
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-text-secondary">
                  <AlertCircle className="h-3.5 w-3.5 text-danger" aria-hidden="true" />
                  {t('practice.invalidCount')}
                </p>
              ) : null}
            </div>
          ) : null}

          {tooMany ? (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] leading-4 text-text-secondary">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-danger" aria-hidden="true" />
              {t('practice.requestedTooMany', {
                requested: localizeDigits(requestedCount ?? 0, language),
                available: localizeDigits(available, language),
              })}
            </p>
          ) : null}

          <button
            type="button"
            onClick={handleStart}
            disabled={isBusy || requestedCount === null}
            className="mt-3 flex h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-[13px] font-bold text-primary-foreground transition-opacity hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
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
