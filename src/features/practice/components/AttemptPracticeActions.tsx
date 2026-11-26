import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { RotateCcw, Target } from 'lucide-react';
import toast from 'react-hot-toast';

import ConfirmModal from '@/shared/components/feedback/ConfirmModal';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { formatCount } from '@/shared/lib/attemptFormat';
import { practiceService, resolvePracticeError } from '../services/practiceService';
import type { PracticeStartResult } from '../types/practice';

interface Props {
  historyId: string;
  retakeCount: number;
  wrongCount: number;
}

interface PartialConfirm {
  available: number;
  total: number;
}

/**
 * The two actions a result owns. It reuses the practice start endpoints, so the
 * free-quota check, XP rules and leaderboard rules stay exactly where they are;
 * this component only chooses which endpoint to call and what to show.
 */
export const AttemptPracticeActions: React.FC<Props> = ({
  historyId,
  retakeCount,
  wrongCount,
}) => {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const [partialConfirm, setPartialConfirm] = useState<PartialConfirm | null>(null);

  const retakes = Math.max(0, Math.trunc(retakeCount));
  const mistakes = Math.max(0, Math.trunc(wrongCount));

  const openAttempt = useCallback(
    (result: PracticeStartResult) => {
      if (result.started && result.attempt?.id) {
        navigate(`/exam/attempt/${result.attempt.id}`);
      }
    },
    [navigate]
  );

  const handleEmpty = useCallback(
    (result: PracticeStartResult) => {
      if (result.reason !== 'empty') return;

      toast.error(
        result.mode === 'wrong_from_history'
          ? t('practice.wrongUnavailable')
          : t('practice.retakeEmpty')
      );
    },
    [t]
  );

  const retakeMutation = useMutation({
    mutationFn: (confirmPartial: boolean) =>
      practiceService.startRetake(historyId, confirmPartial),
    onSuccess: (result) => {
      if (result.started) {
        openAttempt(result);
        return;
      }

      if (result.reason === 'confirm_partial') {
        setPartialConfirm({
          available: result.available_count,
          total: result.total_count,
        });
        return;
      }

      handleEmpty(result);
    },
    onError: (error) => {
      toast.error(resolvePracticeError(error, t('practice.startFailed')));
    },
  });

  const practiceMutation = useMutation({
    mutationFn: () => practiceService.startWrongFromHistory(historyId),
    onSuccess: (result) => {
      if (result.started) {
        openAttempt(result);
        return;
      }

      handleEmpty(result);
    },
    onError: (error) => {
      toast.error(resolvePracticeError(error, t('practice.startFailed')));
    },
  });

  const isBusy = retakeMutation.isPending || practiceMutation.isPending;
  const practiceDisabled = isBusy || mistakes === 0;
  const retakeDisabled = isBusy || retakes === 0;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border-color bg-app px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
          {mistakes === 0 ? (
            <p className="text-center text-[11px] leading-4 text-text-secondary">
              {t('analysis.practiceUnavailable')}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => retakeMutation.mutate(false)}
            disabled={retakeDisabled}
            title={retakes === 0 ? t('analysis.retakeUnavailable') : undefined}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-border-color bg-card-bg px-4 text-[13px] font-bold text-text-primary transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {t('practice.retakeButton')}
          </button>

          <button
            type="button"
            onClick={() => practiceMutation.mutate()}
            disabled={practiceDisabled}
            title={mistakes === 0 ? t('analysis.practiceUnavailable') : undefined}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[13px] font-bold text-primary-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <Target className="h-4 w-4" aria-hidden="true" />
            <span className="min-w-0 truncate">{t('analysis.practiceButton')}</span>
            <span className="shrink-0 rounded-md bg-black/30 px-1.5 py-0.5 text-[11px] tabular-nums">
              {formatCount(mistakes, language)}
            </span>
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={partialConfirm !== null}
        title={t('practice.retakePartialTitle')}
        message={t('practice.retakePartialMessage', {
          available: formatCount(partialConfirm?.available ?? 0, language),
          total: formatCount(partialConfirm?.total ?? 0, language),
        })}
        confirmText={t('practice.startAvailable')}
        cancelText={t('common.cancel')}
        onConfirm={() => {
          setPartialConfirm(null);
          retakeMutation.mutate(true);
        }}
        onCancel={() => setPartialConfirm(null)}
        isLoading={retakeMutation.isPending}
      />
    </>
  );
};

export default AttemptPracticeActions;
