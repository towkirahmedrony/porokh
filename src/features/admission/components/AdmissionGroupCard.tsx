import React from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  ChevronRight,
  FlaskConical,
  GraduationCap,
  Palette,
  type LucideIcon,
} from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import type { AdmissionGroup } from '../types/admission';
import {
  formatAdmissionCount,
  getAdmissionGroupDescription,
  getAdmissionGroupName,
} from '../lib/admissionLabels';

interface AdmissionGroupCardProps {
  group: AdmissionGroup;
  to: string;
}

const GROUP_ICONS: Record<string, LucideIcon> = {
  science: FlaskConical,
  arts: Palette,
  commerce: Briefcase,
};

const GROUP_STYLES: Record<string, string> = {
  science: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  arts: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  commerce: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
};

export const AdmissionGroupCard: React.FC<AdmissionGroupCardProps> = ({
  group,
  to,
}) => {
  const { t, language } = useLanguage();
  const Icon = GROUP_ICONS[group.slug] ?? GraduationCap;
  const iconStyle =
    GROUP_STYLES[group.slug] ?? 'bg-badge-bg text-badge-text';
  const description = getAdmissionGroupDescription(group, t, language);
  const count = formatAdmissionCount(group.totalExams, language);

  return (
    <Link
      to={to}
      className="group !no-underline [text-decoration-line:none!important] flex min-h-[176px] flex-col rounded-2xl border border-card-border bg-card-bg p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconStyle}`}>
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>

        <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-text-secondary">
          {t('admission.examTypeCount', { count })}
        </span>
      </div>

      <div className="mt-4 flex-1">
        <h3 className="font-['Hind_Siliguri'] text-lg font-bold text-text-primary">
          {getAdmissionGroupName(group, t, language)}
        </h3>

        {description && (
          <p className="mt-1.5 font-['Hind_Siliguri'] text-sm leading-6 text-text-secondary">
            {description}
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-end text-primary">
        <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
};
