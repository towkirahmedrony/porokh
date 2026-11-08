import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { formatAdmissionCount } from '../lib/admissionLabels';
import type { AdmissionHubUnit } from '../types/admissionHub';

interface AdmissionUnitCardProps {
  unit: AdmissionHubUnit;
  institutionSlug: string;
}

/**
 * Unit card for the 2-column unit grid.
 *
 * A unit without any published paper, model test or bank question is rendered
 * as a dimmed, non-interactive card with "শীঘ্রই আসছে" instead of a dead link.
 */
const AdmissionUnitCard: React.FC<AdmissionUnitCardProps> = ({
  unit,
  institutionSlug,
}) => {
  const { t, language } = useLanguage();

  const name =
    language === 'en'
      ? unit.nameEn || unit.nameBn
      : unit.nameBn || unit.nameEn || unit.code;

  const countLine = [
    unit.pastPaperCount > 0
      ? t('admission.hub.paperCount', {
          count: formatAdmissionCount(unit.pastPaperCount, language),
        })
      : null,
    unit.questionCount > 0
      ? t('admission.hub.questionsCount', {
          count: formatAdmissionCount(unit.questionCount, language),
        })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const content = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-badge-bg font-['Hind_Siliguri'] text-lg font-bold uppercase text-badge-text">
        {unit.code}
      </span>

      <span className="mt-2.5 line-clamp-2 font-['Hind_Siliguri'] text-sm font-bold leading-snug text-text-primary">
        {name}
      </span>

      <span className="mt-1 text-[11px] font-medium leading-snug text-text-secondary">
        {unit.isAvailable ? countLine : t('admission.hub.comingSoon')}
      </span>
    </>
  );

  if (!unit.isAvailable) {
    return (
      <div
        aria-disabled="true"
        className="flex min-h-[132px] flex-col items-start rounded-[20px] border border-card-border bg-card-bg p-3.5 opacity-60"
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      to={`/admission/${encodeURIComponent(institutionSlug)}/${encodeURIComponent(unit.code)}`}
      className="group flex min-h-[132px] touch-manipulation select-none flex-col items-start rounded-[20px] border border-card-border bg-card-bg p-3.5 transition-[transform,border-color] duration-150 hover:border-primary/40 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring motion-reduce:transition-none"
    >
      {content}
      <span className="mt-auto flex w-full items-center justify-end pt-1 text-primary">
        <ChevronRight
          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
    </Link>
  );
};

export default AdmissionUnitCard;
