import React, { memo } from 'react';
import { Trash2 } from 'lucide-react';
import type { MistakeItem } from '../types/history';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { HistoryQuestionPreview } from './HistoryQuestionPreview';

interface Props {
  item: MistakeItem;
  onDelete: (id: string) => void;
}

export const MistakeCard: React.FC<Props> = memo(({ item, onDelete }) => {
  const { t } = useLanguage();

  // A mistake is a wrong OR skipped answer: label which one it was so a skipped
  // question is never mistaken for a wrong answer.
  const isSkipped = item.status === 'skipped';
  const badgeLabel = isSkipped
    ? t('history.mistakeSkippedBadge')
    : t('history.mistakeWrongBadge');
  const badgeClasses = isSkipped
    ? 'rounded bg-surface-elevated px-2 py-1 text-xs font-bold text-text-secondary'
    : 'rounded bg-badge-bg px-2 py-1 text-xs font-bold text-badge-text';

  return (
    <div className="bg-card-bg border border-card-border p-5 rounded-xl shadow-sm relative group transition-all">
      <div className="mb-4 flex items-start justify-between gap-3">
        <span className={badgeClasses}>{badgeLabel}</span>
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          aria-label={t('history.deleteMistakeAria')}
          title={t('history.deleteMistakeAria')}
          className="flex items-center justify-center rounded-full border border-border-color bg-surface p-2 text-accent transition-colors hover:bg-surface-elevated active:scale-95"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <HistoryQuestionPreview
        question={item.questions}
        selectedOptionId={item.selected_option}
        showCorrectAnswer
      />
    </div>
  );
});

MistakeCard.displayName = 'MistakeCard';
