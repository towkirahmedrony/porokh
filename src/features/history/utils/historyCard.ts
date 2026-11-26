import type { AppLanguage, AppMessageKey } from '@/shared/i18n/messages';
import {
  formatAttemptDate,
  formatCount,
  formatScoreParts,
  resolveDayGroup,
  type DayGroupKey,
} from '@/shared/lib/attemptFormat';
import type { HistoryItem } from '../types/history';

type Translate = (key: AppMessageKey, values?: Record<string, string | number>) => string;

export interface HistoryCardCounts {
  correct: number;
  wrong: number;
  skipped: number;
  total: number;
}

export interface HistoryCardViewModel {
  id: string;
  title: string;
  meta: string;
  scoreText: string;
  totalText: string;
  counts: HistoryCardCounts;
  summary: string;
  /** Percent of the attempt each outcome covers, in correct/wrong/skipped order. */
  segments: [number, number, number];
  badge: 'retake' | 'practice' | null;
  incomplete: boolean;
  timestamp: number;
}

export type HistorySortOrder = 'newest' | 'oldest';

const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

/** Attempt timestamps arrive as ISO strings; an unparseable row sorts last. */
export const getHistoryTimestamp = (item: HistoryItem): number => {
  const raw = item.submitted_at || item.created_at || item.taken_at || '';
  const parsed = raw ? new Date(raw).getTime() : Number.NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
};

/**
 * The list endpoint resolves a paper title only when `exam_id` exists. Legacy
 * custom attempts carry no title anywhere, so the subject stored on the review
 * rows is the honest fallback, then a generic label. Never blank, never
 * "undefined".
 */
export const resolveHistoryTitle = (
  item: HistoryItem,
  language: AppLanguage,
  t: Translate
): { title: string; subject: string } => {
  const paperTitle =
    text(item.exam_title) || text(item.details_json?.exam_title);

  const subjectNames = (item.subjects ?? [])
    .map((subject) =>
      language === 'bn'
        ? text(subject.name_bn) || text(subject.name_en)
        : text(subject.name_en) || text(subject.name_bn)
    )
    .filter(Boolean);

  const fallbackSubject =
    language === 'bn'
      ? text(item.subject_name_bn) || text(item.subject_name_en)
      : text(item.subject_name_en) || text(item.subject_name_bn);

  const subject =
    subjectNames.length > 1
      ? t('history.mixedSubjects')
      : subjectNames[0] || fallbackSubject;

  const practiceTitle =
    item.practice_mode === 'retake'
      ? t('practice.retakeTitle')
      : item.practice_mode
        ? t('practice.wrongTitle')
        : '';

  return {
    title: paperTitle || practiceTitle || subject || t('history.cardFallbackTitle'),
    subject,
  };
};

export const buildHistoryCard = (
  item: HistoryItem,
  language: AppLanguage,
  t: Translate
): HistoryCardViewModel => {
  const { title, subject } = resolveHistoryTitle(item, language, t);
  const correct = Math.max(0, Number(item.correct_count ?? 0));
  const wrong = Math.max(0, Number(item.wrong_count ?? 0));
  const skipped = Math.max(0, Number(item.skipped_count ?? 0));
  const counted = correct + wrong + skipped;
  const total = counted > 0 ? counted : Math.max(0, Number(item.question_count ?? 0));
  const date = formatAttemptDate(
    item.submitted_at || item.created_at || item.taken_at,
    language
  );

  // The subject is only repeated when it is not already the headline.
  const meta = [subject && subject !== title ? subject : '', date]
    .filter(Boolean)
    .join(' · ');

  const summary = [
    correct > 0
      ? t('history.correctCount', { count: formatCount(correct, language) })
      : '',
    wrong > 0 ? t('history.wrongCount', { count: formatCount(wrong, language) }) : '',
    skipped > 0
      ? t('history.skippedCount', { count: formatCount(skipped, language) })
      : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const percent = (value: number): number =>
    total > 0 ? (value / total) * 100 : 0;

  const score = formatScoreParts(item.score, item.total_marks, language);

  return {
    id: item.id,
    title,
    meta,
    scoreText: score.score,
    totalText: score.total,
    counts: { correct, wrong, skipped, total },
    summary,
    segments: [percent(correct), percent(wrong), percent(skipped)],
    badge: item.practice_mode
      ? item.practice_mode === 'retake'
        ? 'retake'
        : 'practice'
      : item.source_history_id
        ? 'practice'
        : null,
    incomplete:
      item.completion_status === 'in_progress' ||
      (!item.completion_status && !item.submitted_at),
    timestamp: getHistoryTimestamp(item),
  };
};

export const filterAndSortHistory = (
  items: HistoryItem[],
  query: string,
  order: HistorySortOrder,
  language: AppLanguage,
  t: Translate
): HistoryItem[] => {
  const needle = query.trim().toLowerCase();

  const matched = needle
    ? items.filter((item) => {
        const { title, subject } = resolveHistoryTitle(item, language, t);
        const haystack = [
          title,
          subject,
          item.exam_title,
          item.details_json?.exam_title,
          ...(item.subjects ?? []).flatMap((entry) => [entry.name_bn, entry.name_en]),
        ]
          .filter((value): value is string => typeof value === 'string')
          .join(' ')
          .toLowerCase();

        return haystack.includes(needle);
      })
    : items;

  return [...matched].sort((a, b) => {
    const diff = getHistoryTimestamp(a) - getHistoryTimestamp(b);
    return order === 'newest' ? -diff : diff;
  });
};

export interface HistoryGroup<T> {
  key: DayGroupKey;
  items: T[];
}

const GROUP_ORDER: DayGroupKey[] = ['today', 'yesterday', 'week', 'earlier'];

/** Day buckets in display order, with empty buckets removed. */
export const groupHistoryByDay = <T>(
  items: T[],
  getIso: (item: T) => string | null | undefined,
  now: Date = new Date()
): HistoryGroup<T>[] => {
  const buckets = new Map<DayGroupKey, T[]>();

  for (const item of items) {
    const key = resolveDayGroup(getIso(item), now);
    const bucket = buckets.get(key) ?? [];
    bucket.push(item);
    buckets.set(key, bucket);
  }

  return GROUP_ORDER.filter((key) => (buckets.get(key)?.length ?? 0) > 0).map(
    (key) => ({ key, items: buckets.get(key) ?? [] })
  );
};
