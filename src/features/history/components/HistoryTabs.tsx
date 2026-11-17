import React, { memo } from 'react';
import { FileText, AlertCircle, Bookmark } from 'lucide-react';
import { TabType } from '../types/history';
import { useLanguage } from '@/shared/i18n/LanguageProvider';

interface Props {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export const HistoryTabs: React.FC<Props> = memo(({ activeTab, setActiveTab }) => {
  const { t } = useLanguage();

  const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
    { id: 'history', label: t('history.tabsHistory'), icon: FileText },
    { id: 'mistakes', label: t('history.tabsMistakes'), icon: AlertCircle },
    { id: 'bookmarks', label: t('history.tabsBookmarks'), icon: Bookmark },
  ];

  return (
    <div className="w-full mb-6 px-1">
      <div
        role="tablist"
        aria-label={t('history.tabsHistory')}
        className="bg-surface border border-border-color grid grid-cols-3 gap-2 p-1.5 rounded-2xl shadow-inner transition-colors"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`
                relative flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 
                py-3 px-1 rounded-xl text-[12px] md:text-sm font-bold transition-all duration-300
                ${isActive 
                  ? 'bg-primary text-primary-foreground shadow-lg scale-[1.02]' 
                  : 'text-text-secondary hover:bg-surface-elevated hover:opacity-80 active:scale-95 bg-transparent'
                }
              `}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'animate-pulse' : ''}`} aria-hidden="true" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

HistoryTabs.displayName = 'HistoryTabs';
