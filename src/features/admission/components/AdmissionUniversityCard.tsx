import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, MapPin } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import type { AdmissionUniversity } from '../types/admission';
import { formatAdmissionCount } from '../lib/admissionLabels';

interface AdmissionUniversityCardProps {
  university: AdmissionUniversity;
  examCount: number;
  unitCount: number;
  to: string;
}

export const AdmissionUniversityCard: React.FC<AdmissionUniversityCardProps> = ({
  university,
  examCount,
  unitCount,
  to,
}) => {
  const { t, language } = useLanguage();
  const name =
    language === 'en'
      ? university.nameEn || university.nameBn
      : university.nameBn || university.nameEn || university.slug;
  const initial = name.trim().charAt(0).toUpperCase() || 'U';
  const examLabel = formatAdmissionCount(examCount, language);
  const unitLabel = formatAdmissionCount(unitCount, language);

  return (
    <Link
      to={to}
      className="group !no-underline [text-decoration-line:none!important] flex h-full flex-col rounded-2xl border border-card-border bg-card-bg p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:scale-[0.99] sm:p-5"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border-color bg-surface font-['Noto_Sans_Bengali'] text-lg font-bold text-primary">
          {initial}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 font-['Noto_Sans_Bengali'] text-base font-bold leading-snug text-text-primary group-hover:text-primary">
            {name}
          </h3>

          {university.shortName && (
            <p className="mt-1 truncate text-xs font-medium text-text-secondary">
              {university.shortName}
            </p>
          )}
        </div>

        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-text-secondary transition-transform group-hover:translate-x-1 group-hover:text-primary" />
      </div>

      {university.location && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-text-secondary">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{university.location}</span>
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        <span className="rounded-full bg-badge-bg px-2.5 py-1 text-xs font-semibold text-badge-text">
          {t('admission.examsCount', { count: examLabel })}
        </span>

        {unitCount > 0 && (
          <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-text-secondary">
            {t('admission.unitsCount', { count: unitLabel })}
          </span>
        )}
      </div>
    </Link>
  );
};
