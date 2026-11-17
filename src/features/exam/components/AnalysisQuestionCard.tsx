import React, { useState, useMemo, useCallback, memo, useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, MinusCircle, ChevronDown, AlertCircle, Flag, Bookmark, Sparkles } from 'lucide-react';
import { Question } from '../types/exam';
import { formatBoardRef } from '../../leaderboard/utils/xpCalculator';
import MathDisplay from '@/shared/components/content/MathDisplay';
import QuestionText from '@/shared/components/content/QuestionText';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { getLocalized, pickLang } from '@/shared/i18n/localize';
import { parseQuestion } from '@/shared/utils/questionFormat';

const AI_COPY = {
  bn: {
    show: 'AI ব্যাখ্যা দেখুন',
    hide: 'ব্যাখ্যা লুকান',
    thinking: 'AI উত্তরটি বিশ্লেষণ করছে',
    title: 'AI ব্যাখ্যা',
  },
  en: {
    show: 'See AI explanation',
    hide: 'Hide explanation',
    thinking: 'AI is analysing the answer',
    title: 'AI explanation',
  },
} as const;

// Purely visual "thinking" pause the first time a card's explanation opens.
const AI_THINK_MS = 800;

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

const normalizeId = (value: string | number | null | undefined): string =>
  value === null || value === undefined ? '' : String(value).trim();

const isCorrectFlag = (option: Question['options'][number]): boolean =>
  option.isCorrect === true ||
  option.is_correct === true ||
  String(option.isCorrect).toLowerCase() === 'true' ||
  String(option.is_correct).toLowerCase() === 'true';

const AnalysisQuestionCard: React.FC<AnalysisQuestionCardProps> = memo(({
  question,
  index,
  userAnswerId,
  status,
  showCorrectAnswers = true,
  initialBookmarked = false,
  onReport,
  onBookmark
}) => {
  const { language, t } = useLanguage();
  const [aiPhase, setAiPhase] = useState<'closed' | 'thinking' | 'open'>('closed');
  const hasThoughtRef = useRef<boolean>(false);
  const aiTimerRef = useRef<number | undefined>(undefined);
  const [isBookmarked, setIsBookmarked] = useState<boolean>(initialBookmarked);
  const [isBookmarkUpdating, setIsBookmarkUpdating] = useState<boolean>(false);

  // Mount the heavy body (KaTeX question text + options) only once the card is
  // near the viewport. Long exams otherwise create thousands of DOM nodes at
  // once, which exhausts GPU tile memory on low-end phones.
  const rootRef = useRef<HTMLDivElement>(null);
  const [bodyReady, setBodyReady] = useState<boolean>(index < 3);

  useEffect(() => {
    if (bodyReady) return;
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
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
    observer.observe(el);
    return () => observer.disconnect();
  }, [bodyReady]);

  useEffect(() => () => window.clearTimeout(aiTimerRef.current), []);

  // Sync with parent unless an optimistic update is still in flight.
  useEffect(() => {
    if (!isBookmarkUpdating) {
      setIsBookmarked(initialBookmarked);
    }
  }, [initialBookmarked, isBookmarkUpdating]);
  
  const correctOption = useMemo(
    () => question.options?.find((opt) => isCorrectFlag(opt)) ?? null,
    [question.options]
  );
  const correctOptionId = normalizeId(correctOption?.id);
  const normalizedAnswerId = normalizeId(userAnswerId);

  const isSkipped = !normalizedAnswerId;
  const isCorrect = !!normalizedAnswerId && !!correctOptionId && normalizedAnswerId === correctOptionId;

  const resolvedStatus = useMemo(() => {
    if (status) return status;
    if (isSkipped) return 'skipped';
    if (!showCorrectAnswers) return 'unknown';
    return isCorrect ? 'correct' : 'wrong';
  }, [status, isSkipped, showCorrectAnswers, isCorrect]);

  // Using standard Tailwind semantic classes where applicable, preserving red/emerald for explicit pass/fail states
  const statusConfig = useMemo(() => {
    if (resolvedStatus === 'skipped') return { 
      textClass: 'text-text-secondary',
      bgClass: 'bg-surface-elevated',
      borderClass: 'border-border-color',
      icon: <MinusCircle size={16} />, 
      label: t('analysis.skipped')
    };
    if (resolvedStatus === 'correct') return { 
      textClass: 'text-emerald-600',
      bgClass: 'bg-emerald-500/10',
      borderClass: 'border-emerald-500/30',
      icon: <CheckCircle2 size={16} />, 
      label: t('analysis.correct')
    };
    if (resolvedStatus === 'wrong') return { 
      textClass: 'text-red-600',
      bgClass: 'bg-red-500/10',
      borderClass: 'border-red-500/30',
      icon: <XCircle size={16} />, 
      label: t('analysis.wrong')
    };
    if (resolvedStatus === 'question_not_found') return {
      textClass: 'text-text-secondary',
      bgClass: 'bg-surface-elevated',
      borderClass: 'border-border-color',
      icon: <AlertCircle size={16} />,
      label: t('analysis.questionNotFound')
    };
    return { 
      textClass: 'text-text-secondary',
      bgClass: 'bg-surface-elevated',
      borderClass: 'border-border-color',
      icon: <MinusCircle size={16} />, 
      label: t('analysis.submitted')
    };
  }, [resolvedStatus, t]);
  
  const rawExamRef = question.exam_references ? JSON.stringify(question.exam_references) : question.board_ref;
  const boardTag = formatBoardRef(rawExamRef || '', language);

  const questionText = useMemo(() => {
    let text = pickLang(language, question.text_bn, question.text_en) || question.text || '';
    const body = question.body;
    if (body && typeof body === 'object') {
      const b = body as Record<string, unknown>;
      text = pickLang(language, String(b.text_bn ?? ''), String(b.text_en ?? '')) || String(b.text ?? '') || text;
    } else if (typeof body === 'string' && body.trim() !== '') {
      text = body || text;
    }
    return text;
  }, [language, question.text_bn, question.text_en, question.text, question.body]);

  const parsedQuestion = useMemo(() => parseQuestion(questionText), [questionText]);

  const explanationText = useMemo(
    () => {
      if (question.explanation && typeof question.explanation === 'object') {
        return getLocalized(question.explanation, language).trim() || t('analysis.explanationFallback');
      }
      return typeof question.explanation === 'string' && question.explanation.trim()
        ? question.explanation.trim()
        : t('analysis.explanationFallback');
    },
    [language, question.explanation, t]
  );

  const copy = String(language).startsWith('en') ? AI_COPY.en : AI_COPY.bn;
  const hasRealExplanation = explanationText !== t('analysis.explanationFallback');

  const handleAiToggle = useCallback(() => {
    window.clearTimeout(aiTimerRef.current);
    if (aiPhase !== 'closed') {
      setAiPhase('closed');
      return;
    }
    if (hasThoughtRef.current) {
      setAiPhase('open');
      return;
    }
    setAiPhase('thinking');
    aiTimerRef.current = window.setTimeout(() => {
      hasThoughtRef.current = true;
      setAiPhase('open');
    }, AI_THINK_MS);
  }, [aiPhase]);

  const imageUrl = question.image_url || question.media_library?.file_url;

  const handleBookmark = useCallback(async () => {
    if (isBookmarkUpdating) return;

    const newState = !isBookmarked;
    setIsBookmarked(newState);
    setIsBookmarkUpdating(true);

    try {
      await onBookmark?.(question.id, newState);
    } catch {
      // Roll back the optimistic state when the server rejects the change.
      setIsBookmarked(!newState);
    } finally {
      setIsBookmarkUpdating(false);
    }
  }, [onBookmark, question.id, isBookmarked, isBookmarkUpdating]);

  return (
    <div
      ref={rootRef}
      className={`rounded-xl overflow-hidden border bg-card-bg [content-visibility:auto] [contain-intrinsic-size:auto_560px] ${statusConfig.borderClass}`}
    >
      <div className="flex justify-between items-center p-3 sm:p-4 border-b border-border-color">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2.5 py-1 rounded-md shadow-sm bg-badge-bg text-badge-text">
            Q{index + 1}
          </span>
          {boardTag && (
             <span className="text-[10px] px-2 py-1 rounded-md border border-border-color bg-badge-bg text-badge-text font-mono tracking-tight">
               {boardTag}
             </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 border-r border-border-color pr-3 mr-1">
            <button 
              type="button"
              onClick={() => void handleBookmark()}
              disabled={isBookmarkUpdating}
              aria-pressed={isBookmarked}
              aria-busy={isBookmarkUpdating}
              className={`p-1.5 rounded-full transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:opacity-50 ${
                isBookmarked 
                  ? 'bg-accent text-text-primary' 
                  : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
              }`}
              title={t('analysis.bookmark')}
            >
              <Bookmark size={16} fill={isBookmarked ? "currentColor" : "none"} strokeWidth={2} />
            </button>
            <button 
              onClick={() => onReport?.(question.id)} 
              className="p-1.5 rounded-full transition-all active:scale-95 text-text-secondary hover:bg-surface-elevated hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus-ring" 
              title={t('analysis.report')}
            >
              <Flag size={16} strokeWidth={2} />
            </button>
          </div>
          <div className={`flex items-center gap-1.5 text-xs sm:text-sm font-bold px-2 py-1 rounded-md ${statusConfig.textClass} ${statusConfig.bgClass}`}>
            {statusConfig.label} {statusConfig.icon}
          </div>
        </div>
      </div>

      {bodyReady ? (
      <div className="p-4 sm:p-5 bg-surface">
        <div className="font-['Noto_Sans_Bengali'] text-[15px] sm:text-base mb-5 leading-relaxed text-text-primary">
          {parsedQuestion.statements.length > 0 ? (
            <>
              <QuestionText text={parsedQuestion.stem} />
              <div className="mt-2 space-y-1">
                {parsedQuestion.statements.map((statement) => (
                  <div key={statement.label} className="whitespace-pre-line">
                    <span className="font-semibold">{statement.label}.</span>{' '}
                    <QuestionText text={statement.text} />
                  </div>
                ))}
              </div>
              {parsedQuestion.tail && <div className="mt-2"><QuestionText text={parsedQuestion.tail} /></div>}
            </>
          ) : (
            <QuestionText text={questionText} />
          )}
          {imageUrl && (
            <img 
              src={imageUrl} 
              alt={t('exam.questionImageAlt')}
              className="mt-4 rounded-xl max-h-56 object-contain border border-border-color bg-surface-elevated mx-auto" 
            />
          )}
        </div>

        <div className="space-y-2.5">
          {question.options?.map((opt) => {
            const isSelected = !!normalizedAnswerId && normalizedAnswerId === normalizeId(opt.id);
            const isAns = showCorrectAnswers && isCorrectFlag(opt);
            
            let containerClasses = "border-border-color bg-surface-elevated";
            let textClasses = "text-text-primary";
            
            if (isAns) {
              containerClasses = "border-emerald-500/50 bg-emerald-500/10";
              textClasses = "text-emerald-700";
            } else if (isSelected && showCorrectAnswers) {
              containerClasses = "border-red-500/50 bg-red-500/10";
              textClasses = "text-red-700/80 line-through";
            } else if (isSelected) {
              containerClasses = "border-focus-ring bg-surface-elevated";
              textClasses = "text-text-primary font-semibold";
            }

            return (
              <div 
                key={opt.id} 
                className={`p-3.5 sm:p-4 rounded-xl border text-sm sm:text-base flex justify-between items-start gap-3 transition-colors ${containerClasses}`}
              >
                <div className={`font-['Noto_Sans_Bengali'] flex-1 ${textClasses}`}>
                  <MathDisplay content={pickLang(language, opt.text_bn, opt.text_en) || opt.text || ''} />
                </div>
                {isAns && <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-500" />}
                {isSelected && showCorrectAnswers && !isAns && <XCircle size={18} className="shrink-0 mt-0.5 text-red-500" />}
                {isSelected && !showCorrectAnswers && <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-text-primary" />}
              </div>
            );
          })}
        </div>

        {showCorrectAnswers && (
          <div className="mt-5 pt-4 border-t border-border-color">
            <button
              type="button"
              onClick={handleAiToggle}
              aria-expanded={aiPhase !== 'closed'}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 to-accent/10 px-4 py-3 text-sm font-bold text-primary transition-colors active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-focus-ring"
            >
              <span className="flex items-center gap-2">
                <Sparkles size={18} className="shrink-0" />
                <span className="font-['Noto_Sans_Bengali']">
                  {aiPhase === 'closed' ? copy.show : copy.hide}
                </span>
              </span>
              <ChevronDown
                size={16}
                className={`shrink-0 transition-transform duration-200 ${aiPhase === 'closed' ? '' : 'rotate-180'}`}
              />
            </button>

            {aiPhase === 'thinking' && (
              <div
                role="status"
                className="mt-3 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 animate-in fade-in"
              >
                <Sparkles size={18} className="shrink-0 text-primary animate-pulse motion-reduce:animate-none" />
                <span className="font-['Noto_Sans_Bengali'] text-sm text-text-secondary">{copy.thinking}</span>
                <span className="flex items-center gap-1" aria-hidden="true">
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce motion-reduce:animate-none"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </span>
              </div>
            )}

            {aiPhase === 'open' && (
              <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:p-5 animate-in fade-in slide-in-from-top-2 duration-300">
                {hasRealExplanation && (
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Sparkles size={14} />
                    </span>
                    <span className="font-['Noto_Sans_Bengali'] text-sm font-bold text-text-primary">{copy.title}</span>
                    <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-primary">
                      AI
                    </span>
                  </div>
                )}
                <div className="text-sm sm:text-base font-['Noto_Sans_Bengali'] leading-relaxed text-text-primary">
                  <MathDisplay content={explanationText} className="whitespace-pre-line" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      ) : (
        <div className="min-h-[380px] bg-surface" aria-hidden="true" />
      )}
    </div>
  );
});

AnalysisQuestionCard.displayName = 'AnalysisQuestionCard';

export default AnalysisQuestionCard;
