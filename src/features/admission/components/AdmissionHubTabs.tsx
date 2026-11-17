import React from 'react';
import { BookOpen, FileQuestion, Trophy } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import type { AdmissionHubTab } from '../types/admissionHub';

interface AdmissionHubTabsProps {
  active: AdmissionHubTab;
  onChange: (tab: AdmissionHubTab) => void;
}

const TABS: Array<{
  value: AdmissionHubTab;
  labelKey: 'admission.hub.tab.papers' | 'admission.hub.tab.models' | 'admission.hub.tab.bank';
  icon: typeof BookOpen;
}> = [
  { value: 'papers', labelKey: 'admission.hub.tab.papers', icon: FileQuestion },
  { value: 'models', labelKey: 'admission.hub.tab.models', icon: Trophy },
  { value: 'bank', labelKey: 'admission.hub.tab.bank', icon: BookOpen },
];

const AdmissionHubTabs: React.FC<AdmissionHubTabsProps> = ({
  active,
  onChange,
}) => {
  const { t } = useLanguage();

  return (
    <div
      role="tablist"
      aria-label={t('admission.hub.tabsLabel')}
      className="grid grid-cols-3 gap-1 rounded-2xl border border-card-border bg-surface p-1"
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.value === active;

        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            id={`admission-hub-tab-${tab.value}`}
            aria-controls={`admission-hub-panel-${tab.value}`}
            aria-selected={isActive}
            onClick={() => onChange(tab.value)}
            className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[11px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring sm:text-xs ${
              isActive
                ? 'bg-card-bg text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{t(tab.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
};

export default AdmissionHubTabs;
