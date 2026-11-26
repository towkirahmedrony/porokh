import { LOCALE_BY_LANGUAGE, localizeDigits } from '@/shared/i18n/messages';
import type { AppLanguage } from '@/shared/i18n/messages';

export type TrendRange = '7' | '30' | 'all';

export interface TrendPoint {
  date: string;
  iso: string;
  score_pct: number;
}

export interface MonthCell {
  /** ISO calendar key, e.g. `2026-11-08`. */
  date: string;
  day: number;
  count: number;
}

const DHAKA_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Dhaka',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const pad = (value: number): string => String(value).padStart(2, '0');

const dateKey = (year: number, monthIndex: number, day: number): string =>
  `${year}-${pad(monthIndex + 1)}-${pad(day)}`;

/** Today's date on the Asia/Dhaka calendar, as `YYYY-MM-DD`. */
export const dhakaTodayKey = (now: Date = new Date()): string =>
  DHAKA_DATE.format(now);

export const parseDateKey = (
  key: string
): { year: number; month: number; day: number } | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);

  if (month < 0 || month > 11 || day < 1 || day > 31) return null;

  return { year, month, day };
};

export const shiftMonth = (
  year: number,
  month: number,
  delta: number
): { year: number; month: number } => {
  const shifted = new Date(Date.UTC(year, month + delta, 1));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() };
};

/**
 * A month laid out as week rows, Sunday first, with `null` for the cells before
 * the first day and after the last. `Date.UTC` keeps the grid free of the
 * device timezone, so a month never shifts by one day on a phone.
 */
export const buildMonthGrid = (
  year: number,
  month: number,
  counts: Record<string, number>
): (MonthCell | null)[][] => {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const totalDays = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const cells: (MonthCell | null)[] = Array.from({ length: firstWeekday }, () => null);

  for (let day = 1; day <= totalDays; day += 1) {
    const key = dateKey(year, month, day);
    cells.push({ date: key, day, count: counts[key] ?? 0 });
  }

  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (MonthCell | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }

  return weeks;
};

export const monthLabel = (
  year: number,
  month: number,
  language: AppLanguage
): string =>
  new Intl.DateTimeFormat(LOCALE_BY_LANGUAGE[language], {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month, 1)));

/** Short weekday names, Sunday first, taken from one fixed reference week. */
export const weekdayLabels = (language: AppLanguage): string[] =>
  Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(LOCALE_BY_LANGUAGE[language], {
      weekday: 'short',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(2024, 0, 7 + index)))
  );

/** Last N points, keeping the ascending order the server sent. */
export const filterTrend = <T extends TrendPoint>(points: T[], range: TrendRange): T[] => {
  if (range === 'all') return points;
  const limit = Number(range);
  if (!Number.isFinite(limit) || limit <= 0) return points;
  return points.slice(Math.max(0, points.length - limit));
};

/**
 * `—` for a value that could not be computed, never `0%`. Under 10 the first
 * decimal matters (a 2% score is not a 2.4% score), so it is kept.
 */
export const formatPercent = (
  value: number | null | undefined,
  language: AppLanguage
): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';

  const rounded = Math.abs(value) < 10 ? Math.round(value * 10) / 10 : Math.round(value);
  return `${localizeDigits(rounded, language)}%`;
};

export const formatCount = (
  value: number | null | undefined,
  language: AppLanguage
): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return localizeDigits(Math.round(value), language);
};

/** The question bank is the app's topic-scoped practice surface. */
export const buildTopicPracticeHref = (subjectId: string, topicId: string): string =>
  `/question-bank?subject=${encodeURIComponent(subjectId)}&topic=${encodeURIComponent(topicId)}`;

const dayLabel = (
  key: string,
  language: AppLanguage,
  month: 'long' | 'short'
): string => {
  const parsed = parseDateKey(key);
  if (!parsed) return key;

  return new Intl.DateTimeFormat(LOCALE_BY_LANGUAGE[language], {
    day: 'numeric',
    month,
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(parsed.year, parsed.month, parsed.day)));
};

/** Dhaka day label such as `৮ নভেম্বর`. */
export const formatDayLabel = (key: string, language: AppLanguage): string =>
  dayLabel(key, language, 'long');

/** Compact axis label such as `৮ নভে.`. */
export const formatShortDayLabel = (key: string, language: AppLanguage): string =>
  dayLabel(key, language, 'short');
