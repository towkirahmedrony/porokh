import React from 'react';
import {
  Award,
  CalendarDays,
  Clock3,
  Download,
  Landmark,
  ListChecks,
  PlayCircle,
} from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import type { AdmissionExam } from '../types/admission';
import { getAdmissionExamAvailability } from '../lib/admissionAdapter';
import { formatAdmissionCount } from '../lib/admissionLabels';

interface AdmissionExamCardProps {
  exam: AdmissionExam;
  onStart: (examId: string) => void;
  onPrepareOffline?: (examId: string) => void;
  isPreparing?: boolean;
  universityName?: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  available: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  'not-started': 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  closed: 'bg-surface text-text-secondary',
  unpublished: 'bg-surface text-text-secondary',
};

export const AdmissionExamCard: React.FC<AdmissionExamCardProps> = ({
  exam,
  onStart,
  onPrepareOffline,
  isPreparing = false,
  universityName,
}) => {
  const { t, language } = useLanguage();
  const availability = getAdmissionExamAvailability(exam);
  const isAvailable = availability === 'available';

  const statusLabel =
    availability === 'available'
      ? t('admission.availability.available')
      : availability === 'not-started'
        ? t('admission.availability.notStarted')
        : availability === 'closed'
          ? t('admission.availability.closed')
          : t('admission.availability.unpublished');

  const unitName = exam.unit
    ? language === 'en' && exam.unit.nameEn
      ? exam.unit.nameEn
      : exam.unit.nameBn
    : null;

  return (
    <article className="flex flex-col rounded-2xl border border-card-border bg-card-bg p-5 shadow-sm transition-colors hover:border-primary/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLES[availability]}`}>
              {statusLabel}
            </span>

            {exam.isPremium && (
              <span className="rounded-full bg-badge-bg px-2.5 py-1 text-[11px] font-bold text-badge-text">
                {t('admission.premium')}
              </span>
            )}

            {unitName && (
              <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
                {t('admission.unitLabel')}: {unitName}
              </span>
            )}
          </div>

          <h3 className="font-['Noto_Sans_Bengali'] text-base font-bold leading-snug text-text-primary sm:text-lg">
            {exam.title}
          </h3>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-secondary">
        {universityName && (
          <span className="inline-flex items-center gap-1.5">
            <Landmark className="h-3.5 w-3.5" aria-hidden="true" />
            {universityName}
          </span>
        )}

        {exam.year !== null && (
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            {t('admission.year', {
              year: formatAdmissionCount(exam.year, language),
            })}
          </span>
        )}

        {exam.modelTestNo !== null && (
          <span className="inline-flex items-center gap-1.5">
            <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
            {t('admission.modelNo', {
              number: formatAdmissionCount(exam.modelTestNo, language),
            })}
          </span>
        )}

        {exam.durationMin !== null && (
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            {t('admission.duration', {
              count: formatAdmissionCount(exam.durationMin, language),
            })}
          </span>
        )}

        {exam.totalMarks !== null && (
          <span className="inline-flex items-center gap-1.5">
            <Award className="h-3.5 w-3.5" aria-hidden="true" />
            {t('admission.marks', {
              count: formatAdmissionCount(exam.totalMarks, language),
            })}
          </span>
        )}

        {exam.questionCount !== null && (
          <span className="inline-flex items-center gap-1.5">
            <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
            {t('admission.questions', {
              count: formatAdmissionCount(exam.questionCount, language),
            })}
          </span>
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        {onPrepareOffline && (
          <button
            type="button"
            onClick={() => onPrepareOffline(exam.id)}
            disabled={!isAvailable || isPreparing}
            className="inline-flex items-center gap-2 rounded-xl border border-border-color bg-surface px-3 py-2.5 text-sm font-semibold text-text-primary transition-all hover:bg-surface-elevated active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {isPreparing
              ? t('admission.exam.preparingOffline')
              : t('admission.exam.prepareOffline')}
          </button>
        )}

        <button
          type="button"
          onClick={() => onStart(exam.id)}
          disabled={!isAvailable}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <PlayCircle className="h-4 w-4" aria-hidden="true" />
          {t('admission.startExam')}
        </button>
      </div>
    </article>
  );
};
