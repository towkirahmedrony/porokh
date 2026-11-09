import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Megaphone } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import type { AppMessageKey } from '@/shared/i18n/messages';
import PullToRefresh from '@/features/groups/components/PullToRefresh';
import { useNotices, useUnreadNoticeCount } from '../hooks/useNotices';
import { NoticePriority } from '../types/noticeTypes';
import NoticeList from '../components/NoticeList';

type NoticeFilter = 'all' | NoticePriority;

const FILTERS: Array<{ value: NoticeFilter; labelKey: AppMessageKey }> = [
  { value: 'all', labelKey: 'notice.all' },
  { value: 'urgent', labelKey: 'notice.urgent' },
  { value: 'important', labelKey: 'notice.important' },
  { value: 'normal', labelKey: 'notice.normal' },
];

const Notices: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [filter, setFilter] = useState<NoticeFilter>('all');
  const { data, isLoading, refetch } = useNotices();
  const { data: unreadCount = 0 } = useUnreadNoticeCount();

  const notices = useMemo(() => {
    const items = data?.items ?? [];
    return filter === 'all'
      ? items
      : items.filter((notice) => notice.priority === filter);
  }, [data?.items, filter]);

  return (
    <div className="flex min-h-screen flex-col bg-app font-['Noto_Sans_Bengali'] text-text-primary">
      <header className="sticky top-0 z-30 border-b border-border-color bg-surface/90 backdrop-blur-md">
        <div className="flex items-center gap-3 p-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={t('common.back')}
            className="-ml-1 p-1 text-text-secondary transition-colors hover:text-text-primary"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-text-primary">
              {t('notice.title')}
            </h1>
            <p className="text-xs text-text-secondary">
              {unreadCount > 0
                ? t('notice.unreadCount', { count: unreadCount })
                : t('notice.subtitle')}
            </p>
          </div>
          <Megaphone
            size={22}
            className="text-primary"
            aria-hidden="true"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto px-4 pb-3">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              aria-pressed={filter === option.value}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                filter === option.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border-color bg-surface text-text-secondary'
              }`}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
      </header>

      <PullToRefresh onRefresh={async () => { await refetch(); }}>
        <div className="flex-1 p-4">
          <NoticeList notices={notices} isLoading={isLoading} />
        </div>
      </PullToRefresh>
    </div>
  );
};

export default Notices;
