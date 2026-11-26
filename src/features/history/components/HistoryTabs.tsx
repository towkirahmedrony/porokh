import React, { memo } from 'react';
import { TabType } from '../types/history';
import { useLanguage } from '@/shared/i18n/LanguageProvider';

interface Props {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

const TABS: { id: TabType; labelKey: 'history.tabsHistory' | 'history.tabsMistakes' | 'history.tabsBookmarks' }[] = [
  { id: 'history', labelKey: 'history.tabsHistory' },
  { id: 'mistakes', labelKey: 'history.tabsMistakes' },
  { id: 'bookmarks', labelKey: 'history.tabsBookmarks' },
];

/**
 * Compact segmented control. It replaces the old heavy tab bar (three tall
 * blocks with animated icons) so the tabs read as one control on the page.
 */
export const HistoryTabs: React.FC<Props> = memo(({ activeTab, setActiveTab }) => {
  const { t } = useLanguage();

  return (
    <div
      role="tablist"
      aria-label={t('history.title')}
      className="grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1"
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => setActiveTab(tab.id)}
            className={`min-h-[44px] rounded-lg px-2 text-[13px] font-semibold leading-5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
              isActive
                ? 'bg-surface-elevated text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {t(tab.labelKey)}
          </button>
        );
      })}
    </div>
  );
});

HistoryTabs.displayName = 'HistoryTabs';
