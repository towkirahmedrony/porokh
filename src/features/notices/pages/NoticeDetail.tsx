import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  Megaphone,
  Paperclip,
  X,
} from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import {
  useDismissNotice,
  useMarkNoticeRead,
  useNotice,
} from '../hooks/useNotices';
import { noticeBody, noticeTitle } from '../types/noticeTypes';
import NoticePriorityBadge from '../components/NoticePriorityBadge';

const formatDateTime = (iso: string | null, language: 'bn' | 'en') => {
  if (!iso) return '';
  const date = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  if (Number.isNaN(date.getTime())) return '';

  return localizeDigits(
    date.toLocaleString(language === 'bn' ? 'bn-BD' : 'en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }),
    language
  );
};

const isExternalLink = (link: string) => link.startsWith('https://');

const NoticeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const { data: notice, isLoading, isError } = useNotice(id);
  const markReadMutation = useMarkNoticeRead();
  const dismissMutation = useDismissNotice();

  useEffect(() => {
    if (notice && !notice.is_read) {
      markReadMutation.mutate(notice.id);
    }
  }, [notice?.id, notice?.is_read]);

  const openLink = (link: string) => {
    if (isExternalLink(link)) {
      window.open(link, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(link);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-app p-4">
        <div className="mx-auto max-w-2xl space-y-3">
          <div className="h-8 w-24 animate-pulse rounded-lg bg-secondary" />
          <div className="h-40 animate-pulse rounded-xl bg-card-bg" />
        </div>
      </div>
    );
  }

  if (isError || !notice) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-app p-6 text-center">
        <Megaphone size={34} className="text-text-secondary opacity-50" />
        <p className="text-sm text-text-secondary">{t('notice.notFound')}</p>
        <button
          type="button"
          onClick={() => navigate('/notices', { replace: true })}
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          {t('notice.backToBoard')}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app pb-10 font-['Noto_Sans_Bengali'] text-text-primary">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border-color bg-surface/90 p-4 backdrop-blur-md">
        <button
          type="button"
          onClick={() =>
            window.history.length > 1
              ? navigate(-1)
              : navigate('/notices', { replace: true })
          }
          aria-label={t('common.back')}
          className="-ml-1 p-1 text-text-secondary transition-colors hover:text-text-primary"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold">
          {t('notice.title')}
        </h1>
        <button
          type="button"
          onClick={() =>
            dismissMutation.mutate(notice.id, {
              onSuccess: () => navigate('/notices', { replace: true }),
            })
          }
          disabled={dismissMutation.isPending}
          aria-label={t('notice.dismiss')}
          className="rounded-full p-1.5 text-text-secondary hover:bg-secondary disabled:opacity-50"
        >
          <X size={18} />
        </button>
      </header>

      <article className="mx-auto w-full max-w-2xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          <NoticePriorityBadge priority={notice.priority} />
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-text-secondary">
            <CalendarDays size={12} aria-hidden="true" />
            {formatDateTime(notice.published_at, language)}
          </span>
        </div>

        <h2 className="mt-2 text-xl font-bold leading-8 text-text-primary">
          {noticeTitle(notice, language)}
        </h2>

        {notice.image_url && (
          <img
            src={notice.image_url}
            alt=""
            loading="lazy"
            className="mt-3 max-h-[420px] w-full rounded-xl border border-card-border object-contain"
          />
        )}

        <p className="mt-4 whitespace-pre-line text-[15px] leading-7 text-text-primary">
          {noticeBody(notice, language)}
        </p>

        <div className="mt-6 flex flex-col gap-2">
          {notice.attachment_url && (
            <button
              type="button"
              onClick={() => openLink(notice.attachment_url as string)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-color bg-card-bg px-4 py-3 text-sm font-semibold text-text-primary"
            >
              <Paperclip size={16} aria-hidden="true" />
              {t('notice.openAttachment')}
            </button>
          )}

          {notice.action_link && (
            <button
              type="button"
              onClick={() => openLink(notice.action_link as string)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
            >
              <ExternalLink size={16} aria-hidden="true" />
              {t('notice.action')}
            </button>
          )}
        </div>

        {notice.expires_at && (
          <p className="mt-4 text-[11px] text-text-secondary">
            {t('notice.expires', {
              date: formatDateTime(notice.expires_at, language),
            })}
          </p>
        )}
      </article>
    </div>
  );
};

export default NoticeDetail;
