import React from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  Clock3,
  Crown,
  FileText,
  ListChecks,
  Loader2,
  MinusCircle,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { useBackInterceptor } from '@/app/navigation/useBackInterceptor';
import { pickLang } from '@/shared/i18n/localize';
import { useAccess } from '@/features/access/hooks/useAccess';
import {
  getModelPaperAvailability,
  type ModelPaperListItem,
} from '../services/modelPaperService';

interface PaperDetailsSheetProps {
  paper: ModelPaperListItem;
  isStarting: boolean;
  onClose: () => void;
  onStart: (paper: ModelPaperListItem) => void;
}

const PaperDetailsSheet: React.FC<PaperDetailsSheetProps> = ({
  paper,
  isStarting,
  onClose,
  onStart,
}) => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { isPremium, unlimitedExam, examsLeft } = useAccess();

  // The sheet is only mounted while open, so Back dismisses it.
  useBackInterceptor(onClose);

  if (typeof document === 'undefined') return null;

  const availability = getModelPaperAvailability(paper);
  const isAvailable = availability === 'available';
  const isLocked = Boolean(paper.is_premium) && !isPremium;

  const availabilityLabel =
    availability === 'available'
      ? t('exam.availability.available')
      : availability === 'not-started'
        ? t('exam.availability.notStarted')
        : t('exam.availability.closed');

  const subjectName = paper.subjects
    ? pickLang(language, paper.subjects.name_bn, paper.subjects.name_en)
    : null;

  const syllabus = pickLang(language, paper.syllabus_details, paper.syllabus_details_en);
  const instructions = pickLang(language, paper.instructions, paper.instructions_en);

  const handlePrimary = () => {
    if (isLocked) {
      onClose();
      navigate('/premium');
      return;
    }

    onStart(paper);
  };

  const quotaLabel = isPremium || unlimitedExam
    ? t('exam.unlimitedExams')
    : examsLeft !== null
      ? t('exam.freeExamsLeft', { count: examsLeft })
      : null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label={t('exam.close')}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('exam.paperDetails')}
        className="relative max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card-bg p-5 pb-8 shadow-2xl animate-in slide-in-from-bottom duration-300 sm:rounded-3xl sm:pb-5"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border-color sm:hidden" />

        <button
          type="button"
          onClick={onClose}
          aria-label={t('exam.close')}
          className="absolute right-3 top-3 rounded-full p-2 text-text-secondary transition-colors hover:bg-surface"
        >
          <X size={18} />
        </button>

        <div className="pr-8">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-badge-bg px-2.5 py-1 text-[11px] font-bold text-badge-text">
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

          <h2 className="font-['Hind_Siliguri'] text-xl font-bold leading-snug text-text-primary">
            {pickLang(language, paper.title, paper.title_en)}
          </h2>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl bg-surface px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
              <ListChecks className="h-4 w-4" aria-hidden="true" />
              {t('exam.questions')}
            </div>
            <p className="mt-1 text-lg font-bold text-text-primary">
              {paper.question_count ?? paper.total_marks ?? 0}
            </p>
          </div>

          <div className="rounded-2xl bg-surface px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              {t('exam.minutes')}
            </div>
            <p className="mt-1 text-lg font-bold text-text-primary">
              {paper.duration_min ?? 0}
            </p>
          </div>

          <div className="rounded-2xl bg-surface px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
              <FileText className="h-4 w-4" aria-hidden="true" />
              {t('exam.marks')}
            </div>
            <p className="mt-1 text-lg font-bold text-text-primary">
              {paper.total_marks ?? 0}
            </p>
          </div>

          <div className="rounded-2xl bg-surface px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
              <MinusCircle className="h-4 w-4" aria-hidden="true" />
              {t('exam.negativeMarks')}
            </div>
            <p className="mt-1 text-lg font-bold text-text-primary">
              {paper.default_negative_marks ?? 0}
            </p>
          </div>
        </div>

        {syllabus && (
          <section className="mt-5">
            <h3 className="flex items-center gap-2 text-sm font-bold text-text-primary">
              <BookOpen className="h-4 w-4 text-primary" aria-hidden="true" />
              {t('exam.syllabus')}
            </h3>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-text-secondary">
              {syllabus}
            </p>
          </section>
        )}

        {instructions && (
          <section className="mt-5">
            <h3 className="text-sm font-bold text-text-primary">{t('exam.instructionsTitle')}</h3>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-text-secondary">
              {instructions}
            </p>
          </section>
        )}

        {!isAvailable && (
          <p className="mt-5 rounded-2xl bg-surface px-4 py-3 text-sm font-medium text-text-secondary">
            {availability === 'not-started'
              ? t('exam.paperNotStartedHint')
              : t('exam.paperClosedHint')}
          </p>
        )}

        {quotaLabel && (
          <p className="mt-4 text-center text-xs font-medium text-text-secondary">
            {quotaLabel}
          </p>
        )}

        <button
          type="button"
          onClick={handlePrimary}
          disabled={isStarting || !isAvailable}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-base font-bold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          {isStarting ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : isLocked ? (
            <Crown className="h-5 w-5" aria-hidden="true" />
          ) : null}
          {isStarting
            ? t('exam.starting')
            : isLocked
              ? t('exam.unlockPremium')
              : t('exam.startExam')}
        </button>
      </div>
    </div>,
    document.body
  );
};

export default PaperDetailsSheet;
