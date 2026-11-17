import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { RotateCcw, Target } from 'lucide-react';
import toast from 'react-hot-toast';

import ConfirmModal from '@/shared/components/feedback/ConfirmModal';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import type { HistoryItem } from '@/features/history/types/history';
import { practiceService, resolvePracticeError } from '../services/practiceService';
import type { PracticeStartResult } from '../types/practice';

interface Props {
  item: HistoryItem;
}

interface PartialConfirm {
  available: number;
  total: number;
}

const buttonClassName =
  'inline-flex items-center gap-1.5 rounded-lg border border-border-color bg-surface px-2.5 py-1.5 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

export const HistoryPracticeActions: React.FC<Props> = ({ item }) => {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const [partialConfirm, setPartialConfirm] = useState<PartialConfirm | null>(null);

  const retakeCount = Math.max(0, Number(item.retake_available_count ?? 0));
  const wrongCount = Math.max(0, Number(item.wrong_available_count ?? 0));

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
      practiceService.startRetake(item.id, confirmPartial),
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
      toast.error(
        resolvePracticeError(error, t('practice.startFailed'))
      );
    },
  });

  const wrongMutation = useMutation({
    mutationFn: () => practiceService.startWrongFromHistory(item.id),
    onSuccess: (result) => {
      if (result.started) {
        openAttempt(result);
        return;
      }

      handleEmpty(result);
    },
    onError: (error) => {
      toast.error(
        resolvePracticeError(error, t('practice.startFailed'))
      );
    },
  });

  const isBusy = retakeMutation.isPending || wrongMutation.isPending;

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => retakeMutation.mutate(false)}
          disabled={isBusy || retakeCount === 0}
          className={buttonClassName}
          title={
            retakeCount === 0
              ? t('practice.noQuestions')
              : t('practice.retakeButton')
          }
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          {t('practice.retakeButton')}
          <span className="rounded-full bg-badge-bg px-1.5 py-0.5 text-[10px] text-badge-text">
            {localizeDigits(retakeCount, language)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => wrongMutation.mutate()}
          disabled={isBusy || wrongCount === 0}
          className={buttonClassName}
          title={
            wrongCount === 0
              ? t('practice.wrongUnavailable')
              : t('practice.wrongButton')
          }
        >
          <Target className="h-3.5 w-3.5" aria-hidden="true" />
          {t('practice.wrongButton')}
          <span className="rounded-full bg-badge-bg px-1.5 py-0.5 text-[10px] text-badge-text">
            {localizeDigits(wrongCount, language)}
          </span>
        </button>
      </div>

      <ConfirmModal
        isOpen={partialConfirm !== null}
        title={t('practice.retakePartialTitle')}
        message={t('practice.retakePartialMessage', {
          available: localizeDigits(partialConfirm?.available ?? 0, language),
          total: localizeDigits(partialConfirm?.total ?? 0, language),
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
