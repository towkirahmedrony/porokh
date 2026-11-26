import React, { memo } from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import {
  formatCount,
  formatDuration,
  formatPercent,
  formatScoreParts,
} from '@/shared/lib/attemptFormat';

interface Props {
  score: number;
  totalMarks: number;
  correct: number;
  wrong: number;
  skipped: number;
  timeTaken: number | null | undefined;
  rank?: number | null;
}

const BAR_COLORS = ['bg-primary', 'bg-danger', 'bg-text-secondary'] as const;

/**
 * One surface for the whole result: the score is the only large number, and the
 * split, accuracy, time and rank sit underneath as one line each. No three
 * bordered stat boxes and no trophy.
 */
export const ResultSummary: React.FC<Props> = memo(
  ({ score, totalMarks, correct, wrong, skipped, timeTaken, rank }) => {
    const { language, t } = useLanguage();

    const scoreText = formatScoreParts(score, totalMarks, language);
    const totalQuestions = Math.max(0, correct) + Math.max(0, wrong) + Math.max(0, skipped);
    const accuracy =
      totalQuestions > 0 ? (Math.max(0, correct) / totalQuestions) * 100 : 0;
    const segments = [
      totalQuestions > 0 ? (Math.max(0, correct) / totalQuestions) * 100 : 0,
      totalQuestions > 0 ? (Math.max(0, wrong) / totalQuestions) * 100 : 0,
      totalQuestions > 0 ? (Math.max(0, skipped) / totalQuestions) * 100 : 0,
    ];

    const hasRank =
      typeof rank === 'number' && Number.isFinite(rank) && rank > 0 && rank < 100000;

    return (
      <section className="rounded-[20px] bg-card-bg p-4">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] leading-4 text-text-secondary">
              {t('analysis.scoreLabel')}
            </p>
            <p className="mt-1 flex items-baseline gap-1">
              <span className="text-[32px] font-bold leading-none tabular-nums text-text-primary">
                {scoreText.score}
              </span>
              <span className="text-[13px] font-semibold text-text-secondary">
                /{scoreText.total}
              </span>
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-[11px] leading-4 text-text-secondary">
              {t('analysis.accuracy')}
            </p>
            <p className="mt-1 text-[15px] font-bold leading-6 tabular-nums text-text-primary">
              {formatPercent(accuracy, language)}
            </p>
          </div>
        </div>

        <div
          className="mt-4 flex h-2 w-full overflow-hidden rounded-full bg-border-color"
          role="img"
          aria-label={`${t('analysis.correct')} ${formatCount(correct, language)}, ${t('analysis.wrong')} ${formatCount(wrong, language)}, ${t('analysis.skipped')} ${formatCount(skipped, language)}`}
        >
          {segments.map((value, index) =>
            value > 0 ? (
              <span
                key={BAR_COLORS[index]}
                className={`${BAR_COLORS[index]} h-full`}
                style={{ width: `${value}%` }}
              />
            ) : null
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-4 text-text-secondary">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
            {t('analysis.correct')} {formatCount(correct, language)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-danger" aria-hidden="true" />
            {t('analysis.wrong')} {formatCount(wrong, language)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-text-secondary" aria-hidden="true" />
            {t('analysis.skipped')} {formatCount(skipped, language)}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border-color pt-3 text-[11px] leading-4 text-text-secondary">
          <span>
            {t('analysis.timeTaken')}{' '}
            <strong className="font-semibold text-text-primary">
              {formatDuration(timeTaken, language)}
            </strong>
          </span>
          {hasRank ? (
            <span>
              {t('analysis.rank')}{' '}
              <strong className="font-semibold tabular-nums text-text-primary">
                #{formatCount(rank, language)}
              </strong>
            </span>
          ) : null}
        </div>
      </section>
    );
  }
);

ResultSummary.displayName = 'ResultSummary';
