import React, { memo, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

import { SettingsBottomSheet } from '@/features/profile/components/SettingsBottomSheet';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { formatShortDate } from '@/shared/lib/attemptFormat';
import { readLocalizedText } from '../utils/questionContent';
import explorerService from '../services/explorerService';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Questions removed from the Mistakes list stay dismissals, not deletions.
 * This sheet is the way back: restoring deletes the dismissal row so the
 * question returns to the pool.
 */
export const DismissedSheet: React.FC<Props> = memo(({ open, onClose }) => {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const userId = user?.id ?? 'anonymous';

  const { data = [], isLoading } = useQuery({
    queryKey: ['history-explorer', userId, 'dismissed'],
    queryFn: () => explorerService.getDismissed(),
    enabled: open,
    staleTime: 30 * 1000,
  });

  const restoreMutation = useMutation({
    mutationFn: (questionId: string) => explorerService.restoreMistakes([questionId]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['history-explorer'] });
      queryClient.invalidateQueries({ queryKey: ['history'] });
      toast.success(t('history.explorerRestored'));
    },
    onError: () => toast.error(t('history.explorerRestoreFailed')),
  });

  const handleRestore = useCallback(
    (questionId: string) => restoreMutation.mutate(questionId),
    [restoreMutation]
  );

  return (
    <SettingsBottomSheet
      open={open}
      title={t('history.explorerDismissedTitle')}
      onClose={onClose}
    >
      {isLoading ? (
        <div className="space-y-2 px-5 pb-4" role="status" aria-label={t('history.loading')}>
          {[0, 1].map((row) => (
            <Skeleton key={row} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <p className="px-5 pb-6 text-[13px] leading-6 text-text-secondary">
          {t('history.explorerDismissedEmpty')}
        </p>
      ) : (
        <div className="divide-y divide-border-color">
          {data.map((item) => {
            const text = readLocalizedText(item.body, language);
            const subject =
              language === 'bn'
                ? item.subject_name_bn || item.subject_name_en
                : item.subject_name_en || item.subject_name_bn;

            return (
              <div key={item.question_id} className="flex items-start gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[13px] leading-6 text-text-primary">
                    {text || t('history.questionNotLoaded')}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-5 text-text-secondary">
                    {[subject, formatShortDate(item.dismissed_at, language)]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRestore(item.question_id)}
                  disabled={restoreMutation.isPending}
                  aria-label={t('history.explorerRestoreAria')}
                  className="flex min-h-[44px] shrink-0 items-center gap-1 rounded-lg px-2 text-[12px] font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  {t('history.explorerRestore')}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </SettingsBottomSheet>
  );
});

DismissedSheet.displayName = 'DismissedSheet';
