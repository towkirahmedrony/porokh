import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import type { AppMessageKey } from '@/shared/i18n/messages';
import { SectionCard, SectionHeading } from './Section';
import {
  filterTrend,
  formatDayLabel,
  formatPercent,
  formatShortDayLabel,
  type TrendRange,
} from '../utils/progressView';
import type { ProgressTrendPoint } from '../types/progress';

interface PerformanceTrendProps {
  points: ProgressTrendPoint[];
}

const RANGES: { value: TrendRange; key: AppMessageKey }[] = [
  { value: '7', key: 'progress.range7' },
  { value: '30', key: 'progress.range30' },
  { value: 'all', key: 'progress.rangeAll' },
];

interface TooltipProps {
  active?: boolean;
  payload?: { payload?: ProgressTrendPoint }[];
}

const TrendTooltip: React.FC<TooltipProps> = ({ active, payload }) => {
  const { language } = useLanguage();
  const point = payload?.[0]?.payload;

  if (!active || !point) return null;

  return (
    <div className="rounded-lg bg-surface-elevated px-2.5 py-1.5 shadow-lg">
      <p className="text-[10px] text-text-secondary">
        {formatDayLabel(point.date, language)}
      </p>
      <p className="text-[13px] font-bold text-text-primary">
        {formatPercent(point.score_pct, language)}
      </p>
    </div>
  );
};

/**
 * Score per attempt. Range switching is client side, so the page never refetches
 * for a control. Fewer than two points cannot show a trend, so it says so.
 */
export const PerformanceTrend: React.FC<PerformanceTrendProps> = ({ points }) => {
  const { language, t } = useLanguage();
  const [range, setRange] = useState<TrendRange>('7');

  const visible = useMemo(() => filterTrend(points, range), [points, range]);
  const minScore = useMemo(
    () => Math.min(0, ...visible.map((point) => Math.floor(point.score_pct))),
    [visible]
  );

  return (
    <SectionCard className="p-4">
      <SectionHeading title={t('progress.trendTitle')} subtitle={t('progress.trendSubtitle')} />

      {points.length < 2 ? (
        <p className="mt-3 rounded-xl bg-secondary px-3 py-6 text-center text-[13px] leading-5 text-text-secondary">
          {t('progress.trendEmpty')}
        </p>
      ) : (
        <>
          <div
            role="group"
            aria-label={t('progress.trendTitle')}
            className="mt-3 flex items-center gap-1.5"
          >
            {RANGES.map((option) => {
              const isActive = range === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRange(option.value)}
                  aria-pressed={isActive}
                  className={`inline-flex h-11 min-w-[44px] items-center justify-center rounded-full px-3 text-[12px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-text-secondary'
                  }`}
                >
                  {t(option.key)}
                </button>
              );
            })}
          </div>

          <div
            className="mt-2 h-[168px] w-full text-primary"
            role="img"
            aria-label={t('progress.trendTitle')}
          >
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              {/* The tick labels are drawn outside the axis line, so the plot keeps
                  a positive left margin and the axis reserves its own width;
                  a negative margin clips "০" against the card edge. */}
              <AreaChart data={visible} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="2 4"
                  vertical={false}
                  stroke="currentColor"
                  strokeOpacity={0.14}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value: string) => formatShortDayLabel(value, language)}
                  stroke="var(--text-secondary)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={26}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[minScore, 100]}
                  ticks={[0, 50, 100].filter((tick) => tick >= minScore)}
                  stroke="var(--text-secondary)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  width={46}
                  tickMargin={4}
                  tickFormatter={(value: number) => formatPercent(value, language)}
                />
                <Tooltip
                  content={<TrendTooltip />}
                  cursor={{ stroke: 'currentColor', strokeOpacity: 0.3, strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="score_pct"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  fill="currentColor"
                  fillOpacity={0.08}
                  dot={{ r: 2.5, strokeWidth: 0, fill: 'currentColor' }}
                  activeDot={{ r: 4, strokeWidth: 0, fill: 'currentColor' }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <ul className="sr-only">
            {visible.map((point) => (
              <li key={point.iso}>
                {t('progress.trendPoint', {
                  date: formatDayLabel(point.date, language),
                  score: formatPercent(point.score_pct, language),
                })}
              </li>
            ))}
          </ul>
        </>
      )}
    </SectionCard>
  );
};
