import React, { memo, useEffect, useMemo, useState } from 'react';
import {
  BookmarkMinus,
  Check,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  StickyNote,
  X,
} from 'lucide-react';

import QuestionText from '@/shared/components/content/QuestionText';
import MathDisplay from '@/shared/components/content/MathDisplay';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import { formatCount, formatShortDate } from '@/shared/lib/attemptFormat';
import type { ExplorerItem, ExplorerSource } from '../types/explorer';
import type { QuestionOption } from '../types/history';
import {
  isCorrectOption,
  normalizeOptionId,
  optionLetter,
  readBodyImageUrl,
  readLocalizedText,
  readOptionText,
} from '../utils/questionContent';

interface Props {
  item: ExplorerItem;
  source: ExplorerSource;
  revealAll: boolean;
  onRemove: () => void;
  onEditNote?: () => void;
}

/**
 * One card for both tabs. Answers stay hidden until the student asks for them:
 * the global eye, this card's own reveal, or a tap on an option (self-test).
 * The previous answer, the correct answer and the explanation are only created
 * in the DOM once the answer is visible, so nothing leaks through devtools or a
 * screenshot.
 */
export const ExplorerCard: React.FC<Props> = memo(
  ({ item, source, revealAll, onRemove, onEditNote }) => {
    const { language, t } = useLanguage();
    // null means "follow the global eye"; true/false is a per-card override.
    const [localOverride, setLocalOverride] = useState<boolean | null>(null);
    const [checkedOptionId, setCheckedOptionId] = useState<string | null>(null);
    const [showExplanation, setShowExplanation] = useState(false);

    const question = item.questions;
    const options = useMemo<QuestionOption[]>(
      () => (Array.isArray(question?.options) ? question.options : []),
      [question?.options]
    );

    const bodyText = useMemo(
      () => readLocalizedText(question?.body, language),
      [question?.body, language]
    );
    const explanationText = useMemo(
      () => readLocalizedText(question?.explanation, language),
      [question?.explanation, language]
    );
    const imageUrl = readBodyImageUrl(question);

    const revealed = checkedOptionId !== null || (localOverride ?? revealAll);

    // Toggling the global eye is a fresh decision for every card.
    useEffect(() => {
      setLocalOverride(null);
    }, [revealAll]);

    const hideAnswer = () => {
      setCheckedOptionId(null);
      setLocalOverride(false);
    };

    const showAnswer = () => setLocalOverride(true);
    const selectedId = normalizeOptionId(item.selected_option);
    const isSkipped = item.status === 'skipped';

    const subjectLabel = item.subject
      ? language === 'bn'
        ? item.subject.name_bn || item.subject.name_en
        : item.subject.name_en || item.subject.name_bn
      : '';
    const topicLabel = item.topic
      ? language === 'bn'
        ? item.topic.name_bn || item.topic.name_en
        : item.topic.name_en || item.topic.name_bn
      : item.chapter
        ? language === 'bn'
          ? item.chapter.name_bn || item.chapter.name_en
          : item.chapter.name_en || item.chapter.name_bn
        : '';

    const meta = [subjectLabel, topicLabel].filter(Boolean).join(' · ');

    const sourceChip = (() => {
      if (!item.source) return '';
      const name =
        item.source.institution_short_name ||
        (language === 'bn'
          ? item.source.institution_name_bn || item.source.institution_name_en
          : item.source.institution_name_en || item.source.institution_name_bn) ||
        '';
      const year = item.source.exam_year ? localizeDigits(item.source.exam_year, language) : '';
      return [name, year].filter(Boolean).join(' ');
    })();

    const isBookmark = source === 'bookmarks';
    const statusLabel = isBookmark
      ? t('history.explorerBookmarkedBadge')
      : isSkipped
        ? t('history.mistakeSkippedBadge')
        : t('history.explorerWrongBadge');

    const wrongMeta = (() => {
      const parts: string[] = [];
      if (item.wrong_times > 0) {
        parts.push(t('history.explorerWrongTimes', { count: formatCount(item.wrong_times, language) }));
      }
      if (item.last_wrong_at) {
        parts.push(formatShortDate(item.last_wrong_at, language));
      }
      return parts.join(' · ');
    })();

    const handleOptionTap = (option: QuestionOption, index: number) => {
      if (revealed) return;
      setCheckedOptionId(normalizeOptionId(option.id) || `__index_${index}`);
    };

    return (
      <article className="rounded-[16px] border border-card-border bg-card-bg p-4">
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold leading-5 ${
                isBookmark || isSkipped
                  ? 'bg-surface-elevated text-text-secondary'
                  : 'bg-badge-bg text-badge-text'
              }`}
            >
              {statusLabel}
            </span>
            {meta ? (
              <span className="min-w-0 truncate text-[11px] leading-5 text-text-secondary">
                {meta}
              </span>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center">
            {onEditNote ? (
              <button
                type="button"
                onClick={onEditNote}
                aria-label={item.note ? t('history.explorerEditNote') : t('history.explorerAddNote')}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-text-secondary transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <StickyNote className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
            ) : null}

            <button
              type="button"
              onClick={onRemove}
              aria-label={
                source === 'bookmarks'
                  ? t('history.explorerRemoveBookmarkAria')
                  : t('history.explorerDismissAria')
              }
              className="flex h-11 w-11 items-center justify-center rounded-lg text-text-secondary transition-colors hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {source === 'bookmarks' ? (
                <BookmarkMinus className="h-[18px] w-[18px]" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-[18px] w-[18px]" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {sourceChip ? (
          <p className="mt-1.5 text-[11px] leading-5 text-text-secondary">{sourceChip}</p>
        ) : null}

        <div className="mt-2 text-[14px] leading-7 text-text-primary">
          {bodyText ? (
            <QuestionText text={bodyText} />
          ) : (
            <p className="text-[13px] leading-6 text-text-secondary">
              {t('history.questionNotLoaded')}
            </p>
          )}
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={t('exam.questionImageAlt')}
              loading="lazy"
              className="mt-3 max-h-56 w-auto rounded-xl border border-border-color bg-surface-elevated object-contain"
            />
          ) : null}
        </div>

        {options.length > 0 ? (
          <div className="mt-3 space-y-2" role="group" aria-label={t('history.explorerOptionsAria')}>
            {options.map((option, index) => {
              const optionId = normalizeOptionId(option.id);
              const isCorrect = revealed && isCorrectOption(option);
              const isPreviousWrong =
                revealed &&
                !isCorrect &&
                selectedId !== '' &&
                (optionId ? optionId === selectedId : false);
              const isCheckedWrong =
                revealed &&
                !isCorrect &&
                checkedOptionId !== null &&
                (optionId ? optionId === checkedOptionId : checkedOptionId === `__index_${index}`);

              const stateClasses = isCorrect
                ? 'border-emerald-500/40 bg-emerald-500/10'
                : isPreviousWrong || isCheckedWrong
                  ? 'border-red-500/40 bg-red-500/10'
                  : 'border-border-color bg-surface';

              const letterClasses = isCorrect
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : isPreviousWrong || isCheckedWrong
                  ? 'bg-red-500/15 text-red-700 dark:text-red-300'
                  : 'bg-surface-elevated text-text-secondary';

              const content = (
                <>
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[12px] font-bold leading-6 ${letterClasses}`}
                    aria-hidden="true"
                  >
                    {optionLetter(index, language)}
                  </span>
                  <span className="min-w-0 flex-1 text-left text-[13px] leading-6 text-text-primary">
                    <MathDisplay content={readOptionText(option, language)} />
                    {typeof option.image_url === 'string' && option.image_url ? (
                      <img
                        src={option.image_url}
                        alt=""
                        loading="lazy"
                        className="mt-2 max-h-36 rounded-lg border border-border-color"
                      />
                    ) : null}
                    {isCorrect ? (
                      <span className="mt-1 block text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                        {t('history.mistakeCorrectAnswer')}
                      </span>
                    ) : null}
                    {isPreviousWrong ? (
                      <span className="mt-1 block text-[11px] font-semibold text-red-700 dark:text-red-300">
                        {t('history.mistakeYourAnswer')}
                      </span>
                    ) : null}
                  </span>
                  {isCorrect ? (
                    <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  ) : isPreviousWrong || isCheckedWrong ? (
                    <X className="mt-1 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
                  ) : null}
                </>
              );

              if (revealed) {
                return (
                  <div
                    key={optionId || index}
                    className={`flex w-full items-start gap-2.5 rounded-xl border px-3 py-2 ${stateClasses}`}
                  >
                    {content}
                  </div>
                );
              }

              return (
                <button
                  key={optionId || index}
                  type="button"
                  onClick={() => handleOptionTap(option, index)}
                  aria-label={`${optionLetter(index, language)}. ${readOptionText(option, language)}`}
                  className={`flex min-h-[44px] w-full items-start gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors active:bg-surface-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${stateClasses}`}
                >
                  {content}
                </button>
              );
            })}
          </div>
        ) : null}

        {revealed && isSkipped && selectedId === '' ? (
          <p className="mt-2 text-[11px] leading-5 text-text-secondary">
            {t('history.explorerSkippedNote')}
          </p>
        ) : null}

        {revealed && explanationText ? (
          <div className="mt-3 border-t border-border-color pt-1">
            <button
              type="button"
              onClick={() => setShowExplanation((value) => !value)}
              aria-expanded={showExplanation}
              className="flex min-h-[44px] w-full items-center gap-2 text-left text-[12px] font-semibold text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showExplanation ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
              {showExplanation ? t('analysis.hideExplanation') : t('analysis.showExplanation')}
            </button>
            {showExplanation ? (
              <div className="rounded-xl bg-surface-elevated p-3 text-[13px] leading-7 text-text-primary">
                <MathDisplay content={explanationText} className="whitespace-pre-line" />
              </div>
            ) : null}
          </div>
        ) : null}

        {item.note ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-border-color bg-surface px-3 py-2">
            <StickyNote className="mt-1 h-3.5 w-3.5 shrink-0 text-text-secondary" aria-hidden="true" />
            <p className="min-w-0 flex-1 whitespace-pre-line text-[12px] leading-6 text-text-secondary">
              {item.note}
            </p>
          </div>
        ) : null}

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="min-w-0 flex-1 truncate text-[11px] leading-5 text-text-secondary">
            {wrongMeta}
          </span>

          <button
            type="button"
            onClick={revealed ? hideAnswer : showAnswer}
            aria-pressed={revealed}
            className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg px-2 text-[12px] font-semibold text-text-secondary transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {revealed ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
            {revealed ? t('history.explorerHideAnswer') : t('history.explorerShowAnswer')}
          </button>
        </div>
      </article>
    );
  }
);

ExplorerCard.displayName = 'ExplorerCard';
