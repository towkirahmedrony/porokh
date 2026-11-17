import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Megaphone } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { NoticeItem } from '../types/noticeTypes';
import NoticeCard from './NoticeCard';

interface NoticeListProps {
  notices: NoticeItem[];
  isLoading: boolean;
  emptyMessage?: string;
}

export const NoticeList: React.FC<NoticeListProps> = ({
  notices,
  isLoading,
  emptyMessage,
}) => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <div className="space-y-2" aria-label={t('common.loading')}>
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="h-24 animate-pulse rounded-xl border border-card-border bg-card-bg"
          />
        ))}
      </div>
    );
  }

  if (notices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center space-y-3 py-16 text-text-secondary">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
          <Megaphone size={26} className="opacity-50" aria-hidden="true" />
        </div>
        <p className="text-sm">{emptyMessage ?? t('notice.empty')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {notices.map((notice) => (
        <NoticeCard
          key={notice.id}
          notice={notice}
          onOpen={(item) => navigate(`/notices/${item.id}`)}
        />
      ))}
    </div>
  );
};

export default NoticeList;
