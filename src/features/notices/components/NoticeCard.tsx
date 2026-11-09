import React, { memo } from 'react';
import { ChevronRight, Paperclip } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import { NoticeItem, noticeBody, noticeTitle } from '../types/noticeTypes';
import NoticePriorityBadge from './NoticePriorityBadge';

interface NoticeCardProps {
  notice: NoticeItem;
  onOpen: (notice: NoticeItem) => void;
}

const formatNoticeDate = (iso: string | null, language: 'bn' | 'en') => {
  if (!iso) return '';
  const date = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  if (Number.isNaN(date.getTime())) return '';

  return localizeDigits(
    date.toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-GB', {
      day: 'numeric',
      month: 'short',
    }),
    language
  );
};

const NoticeCard: React.FC<NoticeCardProps> = ({ notice, onOpen }) => {
  const { language, t } = useLanguage();
  const title = noticeTitle(notice, language);
  const body = noticeBody(notice, language);
  const isUnread = !notice.is_read;

  return (
    <button
      type="button"
      onClick={() => onOpen(notice)}
      className={`w-full rounded-xl border bg-card-bg p-3 text-left transition-colors hover:bg-surface-elevated ${
        isUnread ? 'border-primary/35' : 'border-card-border'
      }`}
    >
      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            {isUnread && (
              <span
                className="h-1.5 w-1.5 rounded-full bg-primary"
                aria-label={t('notice.unread')}
              />
            )}
            <NoticePriorityBadge priority={notice.priority} />
            <span className="text-[10px] font-medium text-text-secondary">
              {formatNoticeDate(notice.published_at, language)}
            </span>
          </div>

          <h3
            className={`font-['Noto_Sans_Bengali'] text-sm leading-5 text-text-primary ${
              isUnread ? 'font-bold' : 'font-semibold'
            }`}
          >
            {title}
          </h3>
          <p className="mt-0.5 line-clamp-2 font-['Noto_Sans_Bengali'] text-xs leading-5 text-text-secondary">
            {body}
          </p>

          {notice.attachment_url && (
            <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-primary">
              <Paperclip size={11} aria-hidden="true" />
              {t('notice.attachment')}
            </span>
          )}
        </div>

        {notice.image_url ? (
          <img
            src={notice.image_url}
            alt=""
            loading="lazy"
            className="h-16 w-16 shrink-0 rounded-lg border border-card-border object-cover"
          />
        ) : (
          <ChevronRight
            size={18}
            className="mt-1 shrink-0 text-text-secondary"
            aria-hidden="true"
          />
        )}
      </div>
    </button>
  );
};

export default memo(NoticeCard);
