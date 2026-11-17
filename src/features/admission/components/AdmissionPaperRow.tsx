import React from 'react';
import { CalendarDays, Lock, PlayCircle } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import { formatAdmissionCount } from '../lib/admissionLabels';
import type { AdmissionHubPaper } from '../types/admissionHub';

interface AdmissionPaperRowProps {
  paper: AdmissionHubPaper;
  onStart: (examId: string) => void;
}

const formatMarks = (value: number): string => String(Number(value));

/**
 * Compact paper/model-test row for the unit hub.
 *
 * Rendering the premium lock here is only a hint; the backend attempt start
 * still enforces quota and premium access, and this component never bypasses
 * that check.
 */
const AdmissionPaperRow: React.FC<AdmissionPaperRowProps> = ({
  paper,
  onStart,
}) => {
  const { t, language } = useLanguage();

  const title =
    language === 'en' && paper.titleEn ? paper.titleEn : paper.title;
  const yearLabel = paper.examYearLabel || paper.examSession;

  const meta = [
    t('admission.hub.questionsCount', {
      count: formatAdmissionCount(paper.questionCount, language),
    }),
    paper.durationMin !== null
      ? t('admission.duration', {
          count: formatAdmissionCount(paper.durationMin, language),
        })
      : null,
    paper.defaultNegativeMarks !== null && paper.defaultNegativeMarks > 0
      ? t('admission.hub.negative', {
          value: localizeDigits(
            formatMarks(paper.defaultNegativeMarks),
            language
          ),
        })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <article className="rounded-2xl border border-card-border bg-card-bg p-3.5 shadow-sm">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {yearLabel && (
              <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-border-color bg-surface px-1.5 py-0.5 text-[10px] font-bold text-text-secondary">
                <CalendarDays className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {localizeDigits(yearLabel, language)}
                </span>
              </span>
            )}

            {paper.isPremium && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                <Lock className="h-3 w-3" aria-hidden="true" />
                {t('admission.premium')}
              </span>
            )}
          </div>

          <h3 className="mt-1.5 line-clamp-2 font-['Noto_Sans_Bengali'] text-sm font-bold leading-snug text-text-primary">
            {title}
          </h3>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-text-secondary">
          {meta}
        </p>

        <button
          type="button"
          onClick={() => onStart(paper.id)}
          aria-label={`${t('admission.startExam')} — ${title}`}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground transition-all hover:opacity-90 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <PlayCircle className="h-4 w-4" aria-hidden="true" />
          {t('admission.hub.start')}
        </button>
      </div>
    </article>
  );
};

export default AdmissionPaperRow;
