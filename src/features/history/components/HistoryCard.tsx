import React, { memo } from 'react';
import { Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { HistoryItem } from '../types/history';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import {
  LOCALE_BY_LANGUAGE,
  localizeDigits,
  type AppMessageKey,
} from '@/shared/i18n/messages';
import type { PracticeMode } from '@/features/practice/types/practice';
import { HistoryPracticeActions } from '@/features/practice/components/HistoryPracticeActions';

const PRACTICE_BADGE_KEYS: Record<PracticeMode, AppMessageKey> = {
  retake: 'practice.retakeBadge',
  wrong_from_history: 'practice.wrongFromHistoryBadge',
  wrong_global: 'practice.wrongGlobalBadge',
};

const PRACTICE_TITLE_KEYS: Record<PracticeMode, AppMessageKey> = {
  retake: 'practice.retakeTitle',
  wrong_from_history: 'practice.wrongTitle',
  wrong_global: 'practice.globalTitle',
};

interface Props {
  item: HistoryItem;
}

export const HistoryCard: React.FC<Props> = memo(({ item }) => {
  const navigate = useNavigate();
  const { language, t } = useLanguage();

  const dateStr = item.submitted_at || item.created_at || item.taken_at || '';
  const parsedDate = dateStr ? new Date(dateStr) : null;
  const hasValidDate = !!parsedDate && !Number.isNaN(parsedDate.getTime());

  const practiceMode = item.practice_mode ?? null;
  const subjectNames = (item.subjects ?? [])
    .map((subject) =>
      ((language === 'bn' ? subject.name_bn : subject.name_en) ||
        (language === 'bn' ? subject.name_en : subject.name_bn) ||
        '').trim(),
    )
    .filter(Boolean);
  const fallbackSubject =
    ((language === 'bn' ? item.subject_name_bn : item.subject_name_en) ||
      (language === 'bn' ? item.subject_name_en : item.subject_name_bn) ||
      '').trim();
  const subjectName =
    subjectNames.length > 1
      ? t('history.mixedSubjects')
      : subjectNames[0] || fallbackSubject;

  const sequenceLabel = item.exam_sequence
    ? t('history.examNumber', {
        number: localizeDigits(item.exam_sequence, language),
      })
    : '';
  const paperTitle = item.exam_title?.trim() || item.details_json?.exam_title?.trim();
  const title =
    (paperTitle && sequenceLabel ? `${paperTitle} — ${sequenceLabel}` : paperTitle) ||
    (practiceMode
      ? t(PRACTICE_TITLE_KEYS[practiceMode])
      : subjectName && sequenceLabel
        ? `${subjectName} — ${sequenceLabel}`
        : sequenceLabel) ||
    t('history.cardFallbackTitle');

  const correct = Math.max(0, Number(item.correct_count ?? 0));
  const wrong = Math.max(0, Number(item.wrong_count ?? 0));
  const skipped = Math.max(0, Number(item.skipped_count ?? 0));
  const hasCounts = correct + wrong + skipped > 0 || Number(item.question_count ?? 0) > 0;

  const hasTotal = Number(item.total_marks) > 0;
  const percentage = hasTotal
    ? Math.round((Number(item.score) / Number(item.total_marks)) * 100)
    : null;
  const isIncomplete =
    item.completion_status === 'in_progress' ||
    (!item.completion_status && !item.submitted_at);
  const formattedDate = hasValidDate
    ? new Intl.DateTimeFormat(LOCALE_BY_LANGUAGE[language], {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(parsedDate)
    : '';

  return (
    <div className="bg-card-bg border border-card-border p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center group">
      <div className="flex-1 overflow-hidden sm:pr-4">
        <h3 className="text-text-primary text-lg font-bold mb-1 truncate">
          {title}
        </h3>
        {paperTitle && subjectName && (
          <p className="text-text-secondary text-sm mb-1 truncate">
            {subjectName}
          </p>
        )}
        <div className="text-text-secondary flex items-center flex-wrap gap-x-3 gap-y-1 text-sm">
          {formattedDate && (
            <span className="flex items-center">
              <Clock className="w-3 h-3 mr-1 shrink-0" aria-hidden="true" />
              {formattedDate}
            </span>
          )}
          {percentage !== null && (
            <span className="rounded-full bg-badge-bg px-2 py-0.5 text-xs font-semibold text-badge-text">
              {t('history.cardPercent', {
                percent: localizeDigits(percentage, language),
              })}
            </span>
          )}
          {isIncomplete && (
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-700">
              {t('history.incomplete')}
            </span>
          )}
          {practiceMode && (
            <span className="rounded-full border border-border-color bg-surface-elevated px-2 py-0.5 text-xs font-semibold text-text-secondary">
              {t(PRACTICE_BADGE_KEYS[practiceMode])}
            </span>
          )}
        </div>
        {hasCounts && (
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-md bg-emerald-500/10 px-2 py-1 font-semibold text-emerald-700">
              {t('history.correctCount', {
                count: localizeDigits(correct, language),
              })}
            </span>
            <span className="rounded-md bg-red-500/10 px-2 py-1 font-semibold text-red-700">
              {t('history.wrongCount', {
                count: localizeDigits(wrong, language),
              })}
            </span>
            <span className="rounded-md bg-surface-elevated px-2 py-1 font-semibold text-text-secondary">
              {t('history.skippedCount', {
                count: localizeDigits(skipped, language),
              })}
            </span>
          </div>
        )}
        <HistoryPracticeActions item={item} />
      </div>
      <div className="text-left shrink-0 sm:text-right">
        <div className="text-primary text-2xl font-bold">
          {localizeDigits(item.score, language)}
          <span className="text-text-secondary text-sm ml-1">
            /{localizeDigits(item.total_marks, language)}
          </span>
        </div>
        <button
          onClick={() => navigate(`/exam/analysis/${item.id}`, { state: item })}
          className="text-primary text-xs hover:underline mt-1 transition-colors hover:opacity-80 active:scale-95"
          aria-label={t('history.cardDetails')}
        >
          {t('history.cardDetails')}
        </button>
      </div>
    </div>
  );
});

HistoryCard.displayName = 'HistoryCard';
