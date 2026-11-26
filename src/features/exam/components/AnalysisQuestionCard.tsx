import React, { useState, useMemo, useCallback, memo, useEffect, useRef } from 'react';
import {
  Check,
  X,
  Minus,
  ChevronDown,
  Bookmark,
  Flag,
  HelpCircle,
} from 'lucide-react';
import { Question } from '../types/exam';
import MathDisplay from '@/shared/components/content/MathDisplay';
import QuestionText from '@/shared/components/content/QuestionText';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { pickLang } from '@/shared/i18n/localize';
import { localizeDigits } from '@/shared/i18n/messages';
import { resolveDisplayText } from '@/shared/utils/localizedText';

export interface AnalysisQuestionCardProps {
  question: Question;
  index: number;
  userAnswerId?: string;
  status?: 'correct' | 'wrong' | 'skipped' | 'question_not_found' | string | null;
  showCorrectAnswers?: boolean;
  initialBookmarked?: boolean;
  onReport?: (questionId: string) => void;
  onBookmark?: (questionId: string, isNowBookmarked: boolean) => Promise<unknown> | void;
}

const OPTION_LABELS = ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ'];

const normalizeId = (value: string | number | null | undefined): string =>
  value === null || value === undefined ? '' : String(value).trim();

const isCorrectFlag = (option: Question['options'][number]): boolean =>
  option.isCorrect === true ||
  option.is_correct === true ||
  String(option.isCorrect).toLowerCase() === 'true' ||
  String(option.is_correct).toLowerCase() === 'true';

const AnalysisQuestionCard: React.FC<AnalysisQuestionCardProps> = memo(
  ({
    question,
    index,
    userAnswerId,
    status,
    showCorrectAnswers = true,
    initialBookmarked = false,
    onReport,
    onBookmark,
  }) => {
    const { language, t } = useLanguage();
    const [explanationOpen, setExplanationOpen] = useState(false);
    const [isBookmarked, setIsBookmarked] = useState(initialBookmarked);
    const [isBookmarkUpdating, setIsBookmarkUpdating] = useState(false);

    // Long exams otherwise mount thousands of KaTeX nodes at once, which
    // exhausts GPU tile memory on low-end phones.
    const rootRef = useRef<HTMLElement>(null);
    const [bodyReady, setBodyReady] = useState(index < 3);

    useEffect(() => {
      if (bodyReady) return;
      const element = rootRef.current;
      if (!element || typeof IntersectionObserver === 'undefined') {
        setBodyReady(true);
        return;
      }
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setBodyReady(true);
            observer.disconnect();
          }
        },
        { rootMargin: '900px 0px' }
      );
      observer.observe(element);
      return () => observer.disconnect();
    }, [bodyReady]);

    // Keep the local toggle in sync unless an optimistic update is in flight.
    useEffect(() => {
      if (!isBookmarkUpdating) setIsBookmarked(initialBookmarked);
    }, [initialBookmarked, isBookmarkUpdating]);

    const questionText = useMemo(() => {
      let value = pickLang(language, question.text_bn, question.text_en) || question.text || '';
      const body = question.body;
      if (body && typeof body === 'object') {
        const record = body as Record<string, unknown>;
        value =
          pickLang(language, String(record.text_bn ?? ''), String(record.text_en ?? '')) ||
          String(record.text ?? '') ||
          value;
      } else if (typeof body === 'string' && body.trim() !== '') {
        value = body;
      }
      return value;
    }, [language, question.text_bn, question.text_en, question.text, question.body]);

    const explanationText = useMemo(
      () => resolveDisplayText(question.explanation, language),
      [question.explanation, language]
    );

    const correctOption = useMemo(
      () => question.options?.find((option) => isCorrectFlag(option)) ?? null,
      [question.options]
    );
    const correctOptionId = normalizeId(correctOption?.id);
    const selectedId = normalizeId(userAnswerId);
    const isSkipped = !selectedId;

    const resolvedStatus = useMemo(() => {
      if (status) return status;
      if (isSkipped) return 'skipped';
      if (!showCorrectAnswers) return 'unknown';
      return selectedId === correctOptionId ? 'correct' : 'wrong';
    }, [status, isSkipped, showCorrectAnswers, selectedId, correctOptionId]);

    const statusBadge = useMemo(() => {
      if (resolvedStatus === 'correct') {
        return {
          label: t('analysis.correct'),
          className: 'bg-success/10 text-emerald-700 dark:text-emerald-300',
          icon: <Check size={13} aria-hidden="true" />,
        };
      }
      if (resolvedStatus === 'wrong') {
        return {
          label: t('analysis.wrong'),
          className: 'bg-danger/10 text-red-700 dark:text-red-300',
          icon: <X size={13} aria-hidden="true" />,
        };
      }
      if (resolvedStatus === 'question_not_found') {
        return {
          label: t('analysis.questionNotFound'),
          className: 'bg-app text-text-secondary',
          icon: <HelpCircle size={13} aria-hidden="true" />,
        };
      }
      return {
        label: resolvedStatus === 'submitted' ? t('analysis.submitted') : t('analysis.skipped'),
        className: 'bg-app text-text-secondary',
        icon: <Minus size={13} aria-hidden="true" />,
      };
    }, [resolvedStatus, t]);

    const hasCorrectAnswer = showCorrectAnswers && correctOptionId.length > 0;
    const imageUrl = question.image_url || question.media_library?.file_url;

    const handleBookmark = useCallback(async () => {
      if (isBookmarkUpdating) return;

      const next = !isBookmarked;
      setIsBookmarked(next);
      setIsBookmarkUpdating(true);

      try {
        await onBookmark?.(question.id, next);
      } catch {
        setIsBookmarked(!next);
      } finally {
        setIsBookmarkUpdating(false);
      }
    }, [onBookmark, question.id, isBookmarked, isBookmarkUpdating]);

    return (
      <article
        ref={rootRef}
        className="overflow-hidden rounded-[20px] bg-card-bg [content-visibility:auto] [contain-intrinsic-size:auto_520px]"
      >
        <header className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-[12px] font-bold leading-5 text-text-secondary">
              {t('analysis.questionNumber', {
                index: localizeDigits(index + 1, language),
              })}
            </span>
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-4 ${statusBadge.className}`}
            >
              {statusBadge.icon}
              {statusBadge.label}
            </span>
          </div>

          <div className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => void handleBookmark()}
              disabled={isBookmarkUpdating}
              aria-pressed={isBookmarked}
              aria-busy={isBookmarkUpdating}
              aria-label={
                isBookmarked ? t('analysis.bookmarkRemove') : t('analysis.bookmarkAria')
              }
              className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50 ${
                isBookmarked ? 'text-primary' : 'text-text-secondary'
              }`}
            >
              <Bookmark
                size={18}
                fill={isBookmarked ? 'currentColor' : 'none'}
                aria-hidden="true"
              />
            </button>

            {onReport ? (
              <button
                type="button"
                onClick={() => onReport(question.id)}
                aria-label={t('analysis.reportAria')}
                className="flex h-11 w-11 items-center justify-center rounded-full text-text-secondary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <Flag size={17} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </header>

        {bodyReady ? (
          <div className="px-4 pb-4">
            <div className="font-bengali text-[14px] leading-6 text-text-primary">
              <QuestionText text={questionText} />
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={t('exam.questionImageAlt')}
                  width={320}
                  height={180}
                  loading="lazy"
                  className="mx-auto mt-3 max-h-56 w-auto rounded-xl border border-border-color object-contain"
                />
              ) : null}
            </div>

            <ul className="mt-3 space-y-2">
              {question.options?.map((option, optionIndex) => {
                const optionId = normalizeId(option.id);
                const isSelected = !!selectedId && selectedId === optionId;
                const isAnswer = hasCorrectAnswer && optionId === correctOptionId;

                const selectedWrong = isSelected && hasCorrectAnswer && !isAnswer;

                return (
                  <li
                    key={option.id}
                    className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-[13px] leading-6 ${
                      isAnswer
                        ? 'border-success/50 bg-success/10 text-text-primary'
                        : selectedWrong
                          ? 'border-danger/50 bg-danger/10 text-text-primary'
                          : isSelected
                            ? 'border-primary/60 bg-primary/5 text-text-primary'
                            : 'border-border-color bg-surface text-text-primary'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        isAnswer
                          ? 'bg-emerald-700 text-white dark:bg-emerald-400 dark:text-emerald-950'
                          : selectedWrong
                            ? 'bg-red-700 text-white dark:bg-red-400 dark:text-red-950'
                            : isSelected
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-secondary text-text-secondary'
                      }`}
                    >
                      {OPTION_LABELS[optionIndex] ?? optionIndex + 1}
                    </span>

                    <div className="min-w-0 flex-1 font-bengali">
                      <MathDisplay
                        content={pickLang(language, option.text_bn, option.text_en) || option.text || ''}
                      />
                      <div className="mt-0.5 flex flex-wrap gap-x-2">
                        {isSelected ? (
                          <span className="text-[10px] font-semibold leading-4 text-text-secondary">
                            {t('analysis.yourAnswer')}
                          </span>
                        ) : null}
                        {isAnswer ? (
                          <span className="text-[10px] font-semibold leading-4 text-emerald-700 dark:text-emerald-300">
                            {t('analysis.correctAnswer')}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {isAnswer ? (
                      <Check size={16} className="mt-1 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    ) : selectedWrong ? (
                      <X size={16} className="mt-1 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
                    ) : null}
                  </li>
                );
              })}
            </ul>

            {!hasCorrectAnswer ? (
              <p className="mt-2 text-[11px] leading-4 text-text-secondary">
                {t('analysis.correctAnswerHidden')}
              </p>
            ) : null}

            {explanationText ? (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setExplanationOpen((open) => !open)}
                  aria-expanded={explanationOpen}
                  className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl bg-app px-3 text-left text-[12px] font-semibold text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  {explanationOpen
                    ? t('analysis.hideExplanation')
                    : t('analysis.showExplanationShort')}
                  <ChevronDown
                    size={16}
                    aria-hidden="true"
                    className={`shrink-0 transition-transform motion-reduce:transition-none ${
                      explanationOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {explanationOpen ? (
                  <div className="mt-2 rounded-xl bg-surface px-3 py-2.5 font-bengali text-[13px] leading-6 text-text-primary">
                    <MathDisplay content={explanationText} className="whitespace-pre-line" />
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-[11px] leading-4 text-text-secondary">
                {t('analysis.explanationFallback')}
              </p>
            )}
          </div>
        ) : (
          <div className="min-h-[320px] bg-surface" aria-hidden="true" />
        )}
      </article>
    );
  }
);

AnalysisQuestionCard.displayName = 'AnalysisQuestionCard';

export default AnalysisQuestionCard;
