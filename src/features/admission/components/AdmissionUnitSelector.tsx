import React from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import type { AdmissionUnitSummary } from '../types/admission';
import { formatAdmissionCount } from '../lib/admissionLabels';

interface AdmissionUnitSelectorProps {
  units: AdmissionUnitSummary[];
  selectedUnitSlug: string | null;
  onSelect: (unitSlug: string | null) => void;
}

export const AdmissionUnitSelector: React.FC<AdmissionUnitSelectorProps> = ({
  units,
  selectedUnitSlug,
  onSelect,
}) => {
  const { t, language } = useLanguage();

  if (units.length === 0) return null;

  const totalExams = units.reduce((total, unit) => total + unit.examCount, 0);

  const options: Array<{
    slug: string | null;
    label: string;
    count: number;
  }> = [
    {
      slug: null,
      label: t('admission.allUnits'),
      count: totalExams,
    },
    ...units.map((unit) => ({
      slug: unit.slug,
      label:
        language === 'en' && unit.nameEn
          ? unit.nameEn
          : unit.nameBn || unit.nameEn || unit.slug,
      count: unit.examCount,
    })),
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
      {options.map((option) => {
        const isActive = selectedUnitSlug === option.slug;
        const countLabel = formatAdmissionCount(option.count, language);

        return (
          <button
            key={option.slug ?? 'all'}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(option.slug)}
            className={`rounded-xl border px-3 py-3 text-left transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
              isActive
                ? 'border-primary bg-accent/10 text-text-primary shadow-sm'
                : 'border-card-border bg-card-bg text-text-secondary hover:border-primary/40 hover:bg-surface'
            }`}
          >
            <span className="block truncate font-['Noto_Sans_Bengali'] text-sm font-bold">
              {option.label}
            </span>
            <span className="mt-1 block text-xs">
              {t('admission.examTypeCount', { count: countLabel })}
            </span>
          </button>
        );
      })}
    </div>
  );
};
