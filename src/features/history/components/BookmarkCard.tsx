import React, { memo } from 'react';
import { Bookmark, Trash2 } from 'lucide-react';
import type { BookmarkItem } from '../types/history';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { HistoryQuestionPreview } from './HistoryQuestionPreview';

interface Props {
  item: BookmarkItem;
  onDelete: (id: string) => void;
}

export const BookmarkCard: React.FC<Props> = memo(({ item, onDelete }) => {
  const { t } = useLanguage();

  return (
    <div className="bg-card-bg border border-card-border p-5 rounded-xl shadow-sm flex justify-between gap-4 transition-all hover:shadow-md">
      <div className="flex-1 overflow-hidden">
        <HistoryQuestionPreview question={item.questions} showCorrectAnswer />
        {item.note && (
          <div className="mt-4 flex w-fit items-center rounded-lg border border-border-color bg-surface p-2 text-sm text-text-secondary">
            <Bookmark
              className="mr-2 h-3 w-3 shrink-0 text-text-secondary"
              aria-hidden="true"
            />
            <span className="max-w-[200px] truncate sm:max-w-xs">{item.note}</span>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDelete(item.id)}
        aria-label={t('history.deleteBookmarkAria')}
        title={t('history.deleteBookmarkAria')}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-color bg-surface text-accent transition-colors hover:bg-surface-elevated active:scale-95"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
});

BookmarkCard.displayName = 'BookmarkCard';
