import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { formatAdmissionCount } from '../lib/admissionLabels';
import type { AdmissionHubUniversity } from '../types/admissionHub';
import UniversityLogo from './UniversityLogo';

interface AdmissionHubUniversityCardProps {
  university: AdmissionHubUniversity;
}

const AdmissionHubUniversityCard: React.FC<AdmissionHubUniversityCardProps> = ({
  university,
}) => {
  const { t, language } = useLanguage();

  const primaryName =
    language === 'en'
      ? university.nameEn || university.nameBn
      : university.nameBn || university.nameEn || '';
  const secondaryName = university.shortName || university.nameEn || '';

  const countLine = [
    t('admission.unitsCount', {
      count: formatAdmissionCount(university.unitCount, language),
    }),
    university.questionCount > 0
      ? t('admission.hub.questionsCount', {
          count: formatAdmissionCount(university.questionCount, language),
        })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link
      to={`/admission/${encodeURIComponent(university.slug)}`}
      className="!no-underline [text-decoration-line:none!important] flex min-h-[140px] touch-manipulation select-none flex-col items-center justify-center rounded-[20px] border border-card-border bg-card-bg px-3 py-4 text-center transition-[transform,border-color] duration-150 hover:border-primary/40 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring motion-reduce:transition-none"
    >
      <UniversityLogo
        logoUrl={university.logoUrl}
        name={primaryName}
        shortName={university.shortName}
      />

      <h2 className="mt-2.5 line-clamp-2 font-['Hind_Siliguri'] text-[13px] font-bold leading-snug text-text-primary">
        {primaryName}
      </h2>

      {secondaryName && (
        <p className="mt-0.5 max-w-full truncate text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
          {secondaryName}
        </p>
      )}

      <p className="mt-1.5 max-w-full truncate text-[10px] font-medium text-text-secondary">
        {countLine}
      </p>
    </Link>
  );
};

export default AdmissionHubUniversityCard;
