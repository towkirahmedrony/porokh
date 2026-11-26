import React from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { pickLang } from '@/shared/i18n/localize';
import { formatCount, formatPercent } from '../utils/progressView';
import type { ProgressLevel, ProgressSummary } from '../types/progress';

interface AccuracyHeroProps {
  summary: ProgressSummary;
  level: ProgressLevel | null;
  totalXp: number;
}

const RING_SIZE = 84;
const RING_STROKE = 7;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const MiniStat: React.FC<{ label: string; value: string; sub?: string }> = ({
  label,
  value,
  sub,
}) => (
  <div className="min-w-0">
    <p className="text-[11px] leading-4 text-text-secondary">{label}</p>
    <p className="mt-0.5 truncate text-[15px] font-bold leading-5 text-text-primary">{value}</p>
    {sub ? (
      <p className="truncate text-[10px] leading-4 text-text-secondary">{sub}</p>
    ) : null}
  </div>
);

/**
 * The whole first screen in one card: accuracy is the only large number, the
 * four facts that explain it sit beside it, and the level bar closes the card.
 */
export const AccuracyHero: React.FC<AccuracyHeroProps> = ({ summary, level, totalXp }) => {
  const { language, t } = useLanguage();

  const accuracy = summary.accuracy_pct;
  const clamped = Math.max(0, Math.min(100, accuracy ?? 0));
  const dashOffset = RING_CIRCUMFERENCE * (1 - clamped / 100);
  const accuracyText = formatPercent(accuracy, language);
  const levelName = level ? pickLang(language, level.name_bn, level.name_en).trim() : '';

  const levelMin = level?.min_xp ?? 0;
  const levelNext = level?.next_min_xp ?? null;
  const levelSpan = levelNext !== null ? Math.max(1, levelNext - levelMin) : 0;
  const levelProgress =
    levelNext !== null
      ? Math.max(0, Math.min(100, ((totalXp - levelMin) / levelSpan) * 100))
      : 100;

  return (
    <section className="rounded-[20px] bg-card-bg p-4">
      <div className="flex items-center gap-4">
        <div className="flex shrink-0 flex-col items-center">
          <svg
            width={RING_SIZE}
            height={RING_SIZE}
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            role="img"
            aria-label={`${t('progress.accuracy')}: ${accuracyText}`}
          >
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke="var(--secondary)"
              strokeWidth={RING_STROKE}
            />
            {accuracy !== null ? (
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-500"
              />
            ) : null}
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-[var(--text-primary)] text-[17px] font-bold"
            >
              {accuracyText}
            </text>
          </svg>
          <p className="mt-1.5 text-[11px] font-semibold leading-4 text-text-secondary">
            {t('progress.accuracy')}
          </p>
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-3">
          <MiniStat
            label={t('progress.exams')}
            value={formatCount(summary.exams_taken, language)}
            sub={
              summary.practice_sessions > 0
                ? `${t('progress.practiceSessions')} ${formatCount(summary.practice_sessions, language)}`
                : undefined
            }
          />
          <MiniStat
            label={t('progress.avgScore')}
            value={formatPercent(summary.average_score_pct, language)}
          />
          <MiniStat
            label={t('progress.streak')}
            value={t('progress.streakDays', {
              count: formatCount(summary.streak_days, language),
            })}
            sub={
              summary.longest_streak_days > 0
                ? t('progress.bestStreak', {
                    count: formatCount(summary.longest_streak_days, language),
                  })
                : undefined
            }
          />
          <MiniStat label={t('progress.xp')} value={formatCount(totalXp, language)} />
        </div>
      </div>

      {level ? (
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] leading-4">
            <span className="min-w-0 truncate font-semibold text-text-primary">
              {t('progress.levelChip', { level: formatCount(level.id, language) })}
              {levelName ? ` · ${levelName}` : ''}
            </span>
            <span className="shrink-0 text-text-secondary">
              {levelNext !== null
                ? `${formatCount(totalXp, language)} / ${formatCount(levelNext, language)} ${t('progress.xp')}`
                : `${formatCount(totalXp, language)} ${t('progress.xp')}`}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-500"
              style={{ width: `${levelProgress}%` }}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
};
