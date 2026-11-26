import React, { memo } from 'react';
import { TabType } from '../types/history';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { formatCount } from '@/shared/lib/attemptFormat';

interface Props {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  counts?: { mistakes?: number; bookmarks?: number };
}

const TABS: { id: TabType; labelKey: 'history.tabsHistory' | 'history.tabsMistakes' | 'history.tabsBookmarks' }[] = [
  { id: 'history', labelKey: 'history.tabsHistory' },
  { id: 'mistakes', labelKey: 'history.tabsMistakes' },
  { id: 'bookmarks', labelKey: 'history.tabsBookmarks' },
];

/**
 * Compact segmented control. The Mistakes and Bookmarks tabs carry their count
 * in the label, so the student can see the pool size without opening the tab.
 */
export const HistoryTabs: React.FC<Props> = memo(({ activeTab, setActiveTab, counts }) => {
  const { language, t } = useLanguage();

  return (
    <div
      role="tablist"
      aria-label={t('history.title')}
      className="grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1"
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const count =
          tab.id === 'mistakes' ? counts?.mistakes : tab.id === 'bookmarks' ? counts?.bookmarks : undefined;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => setActiveTab(tab.id)}
            className={`flex min-h-[44px] min-w-0 items-center justify-center gap-1 rounded-lg px-1.5 text-[13px] font-semibold leading-5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
              isActive
                ? 'bg-surface-elevated text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <span className="min-w-0 truncate">{t(tab.labelKey)}</span>
            {typeof count === 'number' && count > 0 ? (
              <span
                className="shrink-0 text-[11px] tabular-nums text-text-secondary"
              >
                {formatCount(count, language)}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
});

HistoryTabs.displayName = 'HistoryTabs';
