import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, FileCheck2, History, type LucideIcon } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import type { AdmissionExamType } from '../types/admission';
import {
  formatAdmissionCount,
  getAdmissionExamTypeDescription,
  getAdmissionExamTypeLabel,
} from '../lib/admissionLabels';

interface AdmissionExamTypeCardProps {
  examType: AdmissionExamType;
  count: number;
  to: string;
}

const TYPE_ICONS: Record<AdmissionExamType, LucideIcon> = {
  'model-test': FileCheck2,
  'past-exams': History,
};

export const AdmissionExamTypeCard: React.FC<AdmissionExamTypeCardProps> = ({
  examType,
  count,
  to,
}) => {
  const { t, language } = useLanguage();
  const Icon = TYPE_ICONS[examType];
  const available = count > 0;
  const countLabel = formatAdmissionCount(count, language);

  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-badge-bg text-badge-text">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>

        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            available
              ? 'bg-surface text-text-secondary'
              : 'bg-surface text-text-secondary opacity-80'
          }`}
        >
          {available
            ? t('admission.examTypeCount', { count: countLabel })
            : t('admission.typeUnavailable')}
        </span>
      </div>

      <div className="mt-5 flex-1">
        <h3 className="font-['Noto_Sans_Bengali'] text-xl font-bold text-text-primary">
          {getAdmissionExamTypeLabel(examType, t)}
        </h3>
        <p className="mt-1.5 font-['Noto_Sans_Bengali'] text-sm leading-6 text-text-secondary">
          {getAdmissionExamTypeDescription(examType, t)}
        </p>
      </div>

      <div className="mt-5 flex items-center justify-end text-primary">
        <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
      </div>
    </>
  );

  const baseClass =
    'group flex min-h-[196px] flex-col rounded-2xl border p-5 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

  if (!available) {
    return (
      <div
        aria-disabled="true"
        className={`${baseClass} cursor-not-allowed border-card-border bg-surface opacity-70`}
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      to={to}
      className={`${baseClass} !no-underline [text-decoration-line:none!important] border-card-border bg-card-bg shadow-sm hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:scale-[0.99]`}
    >
      {content}
    </Link>
  );
};
