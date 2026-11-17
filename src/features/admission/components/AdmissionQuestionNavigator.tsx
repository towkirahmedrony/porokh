import React from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';

interface AdmissionQuestionNavigatorProps {
  questionIds: string[];
  currentIndex: number;
  answers: Record<string, string>;
  onSelect: (index: number) => void;
}

export const AdmissionQuestionNavigator: React.FC<
  AdmissionQuestionNavigatorProps
> = ({ questionIds, currentIndex, answers, onSelect }) => {
  const { t, language } = useLanguage();
  const answeredCount = questionIds.filter((id) => Boolean(answers[id])).length;

  return (
    <section
      aria-label={t('admission.questionNavigator')}
      className="rounded-2xl border border-card-border bg-card-bg p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-['Noto_Sans_Bengali'] text-sm font-bold text-text-primary">
          {t('admission.questionNavigator')}
        </h2>

        <span className="text-xs font-semibold text-text-secondary">
          {localizeDigits(answeredCount, language)} /{' '}
          {localizeDigits(questionIds.length, language)}
        </span>
      </div>

      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-5">
        {questionIds.map((questionId, index) => {
          const isCurrent = index === currentIndex;
          const isAnswered = Boolean(answers[questionId]);

          return (
            <button
              key={questionId}
              type="button"
              aria-current={isCurrent ? 'true' : undefined}
              aria-label={`${t('admission.questionOf', {
                current: localizeDigits(index + 1, language),
                total: localizeDigits(questionIds.length, language),
              })}${isAnswered ? ` — ${t('admission.answered')}` : ''}`}
              onClick={() => onSelect(index)}
              className={`flex h-9 w-full items-center justify-center rounded-lg border text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                isCurrent
                  ? 'border-primary bg-primary text-primary-foreground'
                  : isAnswered
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'border-border-color bg-surface text-text-secondary hover:bg-surface-elevated'
              }`}
            >
              {localizeDigits(index + 1, language)}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-text-secondary">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
          {t('admission.currentQuestion')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/60" />
          {t('admission.answered')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-border-color bg-surface" />
          {t('admission.unanswered')}
        </span>
      </div>
    </section>
  );
};
