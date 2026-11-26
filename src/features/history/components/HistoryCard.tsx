import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { HistoryItem } from '../types/history';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { buildHistoryCard } from '../utils/historyCard';
import { formatCount } from '@/shared/lib/attemptFormat';

interface Props {
  item: HistoryItem;
  onOpen?: (id: string) => void;
}

const BAR_COLORS = ['bg-primary', 'bg-danger', 'bg-text-secondary'] as const;

/**
 * One surface, one action. The card carries only what a student scans for:
 * which attempt, when, the score, and how the answers split. Retake and
 * practice live on the result page, so nothing inside competes with the tap.
 *
 * The content is phrasing-only (spans) so the native button stays valid HTML.
 */
export const HistoryCard: React.FC<Props> = memo(({ item, onOpen }) => {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const card = buildHistoryCard(item, language, t);

  const open = () => {
    onOpen?.(item.id);
    navigate(`/exam/analysis/${item.id}`, { state: { historySummary: item } });
  };

  const badgeLabel =
    card.badge === 'retake'
      ? t('practice.retakeBadge')
      : card.badge === 'practice'
        ? t('history.badgePractice')
        : '';

  return (
    <button
      type="button"
      onClick={open}
      aria-label={t('history.cardAria', {
        title: card.title,
        score: card.scoreText,
        total: card.totalText,
      })}
      className="block w-full rounded-[20px] bg-card-bg p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-surface-elevated motion-safe:transition-transform motion-safe:active:scale-[0.99]"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="line-clamp-2 min-w-0 flex-1 text-[15px] font-bold leading-6 text-text-primary">
          {card.title}
        </span>

        <span className="shrink-0 text-right leading-none" aria-hidden="true">
          <span className="text-[22px] font-bold tabular-nums text-text-primary">
            {card.scoreText}
          </span>
          <span className="ml-1 text-[12px] font-semibold text-text-secondary">
            /{card.totalText}
          </span>
        </span>
      </span>

      {card.meta ? (
        <span className="mt-1 block truncate text-[11px] leading-4 text-text-secondary">
          {card.meta}
        </span>
      ) : null}

      <span className="mt-3 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[11px] leading-4 text-text-secondary">
          {card.summary || (card.incomplete ? t('history.incomplete') : '')}
        </span>

        {badgeLabel ? (
          <span className="shrink-0 rounded-md bg-app px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-text-secondary">
            {badgeLabel}
          </span>
        ) : null}
      </span>

      <span
        className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-border-color"
        role="img"
        aria-label={`${t('analysis.correct')} ${formatCount(card.counts.correct, language)}, ${t('analysis.wrong')} ${formatCount(card.counts.wrong, language)}, ${t('analysis.skipped')} ${formatCount(card.counts.skipped, language)}`}
      >
        {card.segments.map((value, index) =>
          value > 0 ? (
            <span
              key={BAR_COLORS[index]}
              className={`${BAR_COLORS[index]} h-full`}
              style={{ width: `${value}%` }}
            />
          ) : null
        )}
      </span>
    </button>
  );
});

HistoryCard.displayName = 'HistoryCard';
