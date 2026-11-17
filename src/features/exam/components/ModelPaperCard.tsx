import React from 'react';
import { Clock3, FileText, ListChecks } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { pickLang } from '@/shared/i18n/localize';
import {
  getModelPaperAvailability,
  type ModelPaperListItem,
} from '../services/modelPaperService';

interface ModelPaperCardProps {
  paper: ModelPaperListItem;
  onOpen: (paper: ModelPaperListItem) => void;
}

const STATUS_STYLES: Record<string, string> = {
  available: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  'not-started': 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  closed: 'bg-surface text-text-secondary',
};

const ModelPaperCard: React.FC<ModelPaperCardProps> = ({ paper, onOpen }) => {
  const { t, language } = useLanguage();
  const availability = getModelPaperAvailability(paper);
  const subjectName = paper.subjects
    ? pickLang(language, paper.subjects.name_bn, paper.subjects.name_en)
    : null;

  const availabilityLabel =
    availability === 'available'
      ? t('exam.availability.available')
      : availability === 'not-started'
        ? t('exam.availability.notStarted')
        : t('exam.availability.closed');

  return (
    <button
      type="button"
      onClick={() => onOpen(paper)}
      className="w-full rounded-2xl bg-card-bg p-4 text-left transition-all hover:bg-surface-elevated active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLES[availability]}`}>
              {availabilityLabel}
            </span>
            {paper.is_premium && (
              <span className="rounded-full bg-badge-bg px-2.5 py-1 text-[11px] font-bold text-badge-text">
                {t('exam.premiumPaper')}
              </span>
            )}
            {subjectName && (
              <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
                {subjectName}
              </span>
            )}
          </div>

          <h3 className="font-['Noto_Sans_Bengali'] text-base font-bold leading-snug text-text-primary">
            {pickLang(language, paper.title, paper.title_en)}
          </h3>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-secondary">
        <span className="inline-flex items-center gap-1.5">
          <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
          {t('exam.questionsCount', {
            count: paper.question_count ?? paper.total_marks ?? 0,
          })}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
          {t('exam.minutesValue', { count: paper.duration_min ?? 0 })}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          {t('exam.marksValue', { count: paper.total_marks ?? 0 })}
        </span>
      </div>
    </button>
  );
};

export default ModelPaperCard;
