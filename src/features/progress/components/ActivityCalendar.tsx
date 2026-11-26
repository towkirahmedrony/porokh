import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import { SectionCard, SectionHeading } from './Section';
import {
  buildMonthGrid,
  dhakaTodayKey,
  formatDayLabel,
  monthLabel,
  parseDateKey,
  shiftMonth,
  weekdayLabels,
} from '../utils/progressView';
import type { ProgressActivityDay } from '../types/progress';

interface ActivityCalendarProps {
  days: ProgressActivityDay[];
}

/**
 * Three filled steps plus empty. The top step is a solid fill with a darkening
 * layer so the white number stays readable in both themes; the lower steps sit
 * over the card surface and keep the theme's primary text colour.
 */
const levelOf = (count: number): 0 | 1 | 2 | 3 => {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  return 3;
};

const FILL: Record<1 | 2 | 3, number> = { 1: 0.22, 2: 0.45, 3: 1 };

/**
 * One month at a time, Sunday first. Days are 44px tap targets, so the grid is
 * usable with a thumb, not just readable. Days outside the data window are
 * simply empty, never a guessed value.
 */
export const ActivityCalendar: React.FC<ActivityCalendarProps> = ({ days }) => {
  const { language, t } = useLanguage();
  const todayKey = dhakaTodayKey();
  const localNow = new Date();
  const today =
    parseDateKey(todayKey) ?? {
      year: localNow.getFullYear(),
      month: localNow.getMonth(),
      day: localNow.getDate(),
    };

  const [view, setView] = useState({ year: today.year, month: today.month });
  const [selected, setSelected] = useState<string | null>(todayKey);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const day of days) map[day.date] = day.count;
    return map;
  }, [days]);

  const weeks = useMemo(
    () => buildMonthGrid(view.year, view.month, counts),
    [view.year, view.month, counts]
  );

  const isCurrentMonth = view.year === today.year && view.month === today.month;
  const monthTotal = weeks
    .flat()
    .reduce((sum, cell) => sum + (cell?.count ?? 0), 0);

  const weekdays = weekdayLabels(language);
  const selectedCount = selected ? counts[selected] ?? 0 : 0;

  const goToMonth = (delta: number) => {
    setView((current) => shiftMonth(current.year, current.month, delta));
    setSelected(null);
  };

  return (
    <SectionCard className="p-4">
      <SectionHeading title={t('progress.calendarTitle')} subtitle={t('progress.calendarSubtitle')} />

      <div className="mt-2 flex items-center justify-between">
        <p className="text-[13px] font-semibold text-text-primary">
          {monthLabel(view.year, view.month, language)}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => goToMonth(-1)}
            aria-label={t('progress.calendarPrev')}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => goToMonth(1)}
            disabled={isCurrentMonth}
            aria-label={t('progress.calendarNext')}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="-mx-2 mt-1 grid grid-cols-7" aria-hidden="true">
        {weekdays.map((label, index) => (
          <span
            key={`${label}-${index}`}
            className="text-center text-[10px] font-medium leading-5 text-text-secondary"
          >
            {label}
          </span>
        ))}
      </div>

      <div className="-mx-2 grid grid-cols-7">
        {weeks.flat().map((cell, index) => {
          if (!cell) {
            return <span key={`empty-${index}`} className="h-11" aria-hidden="true" />;
          }

          const isSelected = selected === cell.date;
          const isToday = cell.date === todayKey;
          const level = levelOf(cell.count);
          const dayNumber = localizeDigits(cell.day, language);
          const dayLabel = formatDayLabel(cell.date, language);

          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => setSelected(cell.date)}
              aria-pressed={isSelected}
              aria-label={
                cell.count > 0
                  ? t('progress.calendarDay', {
                      date: dayLabel,
                      count: localizeDigits(cell.count, language),
                    })
                  : t('progress.calendarEmptyDay', { date: dayLabel })
              }
              className={`flex h-11 w-full items-center justify-center rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                isSelected ? 'ring-2 ring-primary' : ''
              }`}
            >
              <span
                className={`relative flex h-9 w-9 items-center justify-center rounded-[10px] bg-secondary text-[11px] font-semibold ${
                  level === 0
                    ? 'text-text-secondary'
                    : level === 3
                      ? 'text-primary-foreground'
                      : 'text-text-primary'
                }`}
              >
                {level !== 0 ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-[10px] bg-primary"
                    style={{ opacity: FILL[level] }}
                  />
                ) : null}
                {level === 3 ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-[10px] bg-black/20"
                  />
                ) : null}
                <span className="relative">{dayNumber}</span>
                {isToday ? (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-1 h-1 w-1 rounded-full bg-accent"
                  />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="min-h-[16px] text-[11px] leading-4 text-text-secondary">
          {selected
            ? selectedCount > 0
              ? t('progress.calendarSelected', {
                  date: formatDayLabel(selected, language),
                  count: localizeDigits(selectedCount, language),
                })
              : t('progress.calendarSelectedEmpty', {
                  date: formatDayLabel(selected, language),
                })
            : monthTotal === 0
              ? t('progress.calendarEmptyMonth')
              : ''}
        </p>

        <div className="flex items-center gap-1.5 text-[10px] text-text-secondary">
          <span>{t('progress.calendarLess')}</span>
          {[0, 1, 2, 3].map((count) => {
            const level = levelOf(count);

            return (
              <span
                key={count}
                className="relative flex h-3 w-3 items-center justify-center overflow-hidden rounded-[3px] bg-secondary"
              >
                {level !== 0 ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 bg-primary"
                    style={{ opacity: FILL[level] }}
                  />
                ) : null}
                {level === 3 ? (
                  <span aria-hidden="true" className="absolute inset-0 bg-black/20" />
                ) : null}
              </span>
            );
          })}
          <span>{t('progress.calendarMore')}</span>
        </div>
      </div>
    </SectionCard>
  );
};

