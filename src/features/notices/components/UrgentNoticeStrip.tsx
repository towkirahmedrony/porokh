import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronRight, X } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { useDismissNotice, useUrgentNotice } from '../hooks/useNotices';
import { noticeTitle } from '../types/noticeTypes';

const UrgentNoticeStrip: React.FC = () => {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const { data: notice } = useUrgentNotice();
  const dismissMutation = useDismissNotice();

  if (!notice) return null;

  return (
    <section className="mt-2 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2">
      <AlertTriangle
        size={16}
        className="mt-0.5 shrink-0 text-red-600 dark:text-red-400"
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={() => navigate(`/notices/${notice.id}`)}
        className="min-w-0 flex-1 text-left"
      >
        <span className="block text-[10px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400">
          {t('notice.urgent')}
        </span>
        <span className="line-clamp-2 font-['Noto_Sans_Bengali'] text-xs font-semibold leading-5 text-text-primary">
          {noticeTitle(notice, language)}
        </span>
      </button>
      <button
        type="button"
        onClick={() => navigate(`/notices/${notice.id}`)}
        aria-label={t('notice.view')}
        className="mt-0.5 shrink-0 rounded-full p-1 text-red-600 hover:bg-red-500/10 dark:text-red-400"
      >
        <ChevronRight size={16} />
      </button>
      <button
        type="button"
        onClick={() => dismissMutation.mutate(notice.id)}
        disabled={dismissMutation.isPending}
        aria-label={t('notice.dismiss')}
        className="mt-0.5 shrink-0 rounded-full p-1 text-text-secondary hover:bg-red-500/10 disabled:opacity-50"
      >
        <X size={14} />
      </button>
    </section>
  );
};

export default UrgentNoticeStrip;
