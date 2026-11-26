import {
  LOCALE_BY_LANGUAGE,
  localizeDigits,
  type AppLanguage,
} from '@/shared/i18n/messages';

/**
 * One formatter for the History list and the attempt review page: every number,
 * score, duration and date on those two screens comes from here, so a value can
 * never be Latin digits on one page and Bengali on the other.
 */

const BN_MONTHS = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
];

const EN_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const NUMBER_FORMATTER = new Intl.NumberFormat('en-US');

const DEFAULT_TIMEZONE = 'Asia/Dhaka';

interface DhakaParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const dhakaFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: DEFAULT_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const parseIso = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Calendar fields of an instant on the Dhaka clock. */
const dhakaParts = (date: Date): DhakaParts => {
  const parts = dhakaFormatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: read('year'),
    month: read('month') - 1,
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
  };
};

const dayKey = (parts: DhakaParts): string =>
  `${parts.year}-${String(parts.month + 1).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;

const shiftDay = (parts: DhakaParts, days: number): DhakaParts => {
  const shifted = new Date(Date.UTC(parts.year, parts.month, parts.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: 0,
    minute: 0,
  };
};

export interface ScoreParts {
  score: string;
  total: string;
}

/**
 * `0.75 / 20` becomes `{ score: '০.৭৫', total: '২০' }`. At most two decimals
 * and trailing zeros trimmed, so 2.5 and 2.50 never differ between build paths.
 */
export const formatDecimal = (
  value: number | null | undefined,
  language: AppLanguage,
  maxDecimals = 2
): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';

  const factor = 10 ** maxDecimals;
  const rounded = Math.round((value + Number.EPSILON) * factor) / factor;
  const fixed = rounded.toFixed(maxDecimals).replace(/\.?0+$/, '');

  return localizeDigits(fixed || '0', language);
};

export const formatCount = (
  value: number | null | undefined,
  language: AppLanguage
): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return localizeDigits(Math.round(value), language);
};

/** Accuracy keeps one decimal below 10%, where the difference matters. */
export const formatPercent = (
  value: number | null | undefined,
  language: AppLanguage
): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';

  const rounded = Math.abs(value) < 10 ? Math.round(value * 10) / 10 : Math.round(value);
  return `${localizeDigits(rounded, language)}%`;
};

export const formatScoreParts = (
  score: number | null | undefined,
  total: number | null | undefined,
  language: AppLanguage
): ScoreParts => ({
  score: formatDecimal(Number(score ?? 0), language),
  total: formatDecimal(Number(total ?? 0), language),
});

/** `৪ মিনিট ৩২ সেকেন্ড`, `১ ঘণ্টা ২ মিনিট`, `৫২ সেকেন্ড`. */
export const formatDuration = (
  seconds: number | null | undefined,
  language: AppLanguage
): string => {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return '—';
  }

  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (language === 'en') {
    if (hours > 0) return `${formatCount(hours, language)}h ${formatCount(minutes, language)}m`;
    if (minutes > 0) return `${formatCount(minutes, language)}m ${formatCount(secs, language)}s`;
    return `${formatCount(secs, language)}s`;
  }

  if (hours > 0) {
    return `${formatCount(hours, language)} ঘণ্টা ${formatCount(minutes, language)} মিনিট`;
  }
  if (minutes > 0) {
    return `${formatCount(minutes, language)} মিনিট ${formatCount(secs, language)} সেকেন্ড`;
  }
  return `${formatCount(secs, language)} সেকেন্ড`;
};

const bnPeriod = (hour: number): string => {
  if (hour >= 4 && hour < 6) return 'ভোর';
  if (hour >= 6 && hour < 12) return 'সকাল';
  if (hour >= 12 && hour < 16) return 'দুপুর';
  if (hour >= 16 && hour < 18) return 'বিকেল';
  if (hour >= 18 && hour < 20) return 'সন্ধ্যা';
  return 'রাত';
};

export const formatClockTime = (
  iso: string | null | undefined,
  language: AppLanguage
): string => {
  const date = parseIso(iso);
  if (!date) return '';

  const { hour, minute } = dhakaParts(date);
  const minuteText = String(minute).padStart(2, '0');

  if (language === 'en') {
    const suffix = hour < 12 ? 'am' : 'pm';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minuteText} ${suffix}`;
  }

  return `${bnPeriod(hour)} ${localizeDigits(hour % 12 || 12, language)}:${localizeDigits(minuteText, language)}`;
};

/** `৯ নভেম্বর ২০২৬ · রাত ১:১০` on the Dhaka clock. */
export const formatAttemptDate = (
  iso: string | null | undefined,
  language: AppLanguage
): string => {
  const date = parseIso(iso);
  if (!date) return '';

  const { year, month, day } = dhakaParts(date);
  const months = language === 'bn' ? BN_MONTHS : EN_MONTHS;
  const dayText = localizeDigits(day, language);
  const yearText = language === 'bn' ? localizeDigits(year, language) : NUMBER_FORMATTER.format(year);
  const clock = formatClockTime(iso, language);

  return `${dayText} ${months[month]} ${yearText}${clock ? ` · ${clock}` : ''}`;
};

export type DayGroupKey = 'today' | 'yesterday' | 'week' | 'earlier';

/**
 * Group headings are calendar based on Dhaka time, so an attempt submitted at
 * 00:30 belongs to today even when the device clock is in another zone.
 * `this week` means the previous seven days, excluding today and yesterday.
 */
export const resolveDayGroup = (
  iso: string | null | undefined,
  now: Date = new Date()
): DayGroupKey => {
  const date = parseIso(iso);
  if (!date) return 'earlier';

  const target = dayKey(dhakaParts(date));
  const today = dhakaParts(now);
  const todayKey = dayKey(today);
  const yesterdayKey = dayKey(shiftDay(today, -1));

  if (target === todayKey) return 'today';
  if (target === yesterdayKey) return 'yesterday';

  const weekStart = dayKey(shiftDay(today, -7));
  if (target > weekStart && target < yesterdayKey) return 'week';

  return 'earlier';
};

/** Short day label for section headings, e.g. `৯ নভেম্বর`. */
export const formatShortDate = (
  iso: string | null | undefined,
  language: AppLanguage
): string => {
  const date = parseIso(iso);
  if (!date) return '';

  const { month, day } = dhakaParts(date);
  const months = language === 'bn' ? BN_MONTHS : EN_MONTHS;
  return `${localizeDigits(day, language)} ${months[month]}`;
};

export const localeForLanguage = (language: AppLanguage): string =>
  LOCALE_BY_LANGUAGE[language];
