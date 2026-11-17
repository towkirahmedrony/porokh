import React, { memo } from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { ArrowLeft, Bell, Megaphone } from 'lucide-react';

interface NotificationHeaderProps {
  activeTab: 'notifications' | 'notices';
  setActiveTab: (tab: 'notifications' | 'notices') => void;
  onBack: () => void;
}

const NotificationHeader: React.FC<NotificationHeaderProps> = ({ activeTab, setActiveTab, onBack }) => {
  const { t } = useLanguage();
  return (
    <div className="sticky top-0 z-30 backdrop-blur-md border-b bg-surface/90 border-border-color">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack} 
            aria-label={t('common.back')}
            className="p-1 -ml-1 transition-colors hover:opacity-70 text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-text-primary">{t('notification.title')}</h1>
        </div>
      </div>

      <div className="flex px-4 border-b border-border-color">
        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex-1 flex items-center justify-center gap-2 pb-3 text-sm transition-all relative ${
            activeTab === 'notifications' 
              ? 'font-bold text-primary' 
              : 'font-medium text-text-secondary hover:text-text-primary'
          }`}
        >
          <Bell size={18} />
          {t('notification.tabNotifications')}
          {activeTab === 'notifications' && (
            <span className="absolute bottom-0 w-full h-0.5 rounded-t-full shadow-sm bg-primary" />
          )}
        </button>
        
        <button
          onClick={() => setActiveTab('notices')}
          className={`flex-1 flex items-center justify-center gap-2 pb-3 text-sm transition-all relative ${
            activeTab === 'notices' 
              ? 'font-bold text-primary' 
              : 'font-medium text-text-secondary hover:text-text-primary'
          }`}
        >
          <Megaphone size={18} />
          {t('notification.tabNotices')}
          {activeTab === 'notices' && (
            <span className="absolute bottom-0 w-full h-0.5 rounded-t-full shadow-sm bg-primary" />
          )}
        </button>
      </div>
    </div>
  );
};

export default memo(NotificationHeader);
