import React, { memo } from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { Check } from 'lucide-react';

interface NotificationEmptyStateProps {
  activeTab: 'notifications' | 'notices';
}

const NotificationEmptyState: React.FC<NotificationEmptyStateProps> = ({ activeTab }) => {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-4 text-text-secondary">
      <div className="w-16 h-16 rounded-full flex items-center justify-center bg-secondary">
        <Check size={32} className="text-text-secondary opacity-50" />
      </div>
      <p>{t(activeTab === 'notifications' ? 'notification.emptyNotifications' : 'notification.emptyNotices')}</p>
    </div>
  );
};

export default memo(NotificationEmptyState);
