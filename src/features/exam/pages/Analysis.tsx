import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

import AnalysisQuestionCard from '../components/AnalysisQuestionCard';
import { ResultSummary } from '../components/ResultSummary';
import ReportModal, {
  QuestionMetaData,
  ReportPayload as ModalReportPayload,
} from '@/shared/components/feedback/ReportModal';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { apiClient } from '@/shared/lib/apiClient';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import {
  formatAttemptDate,
  formatCount,
} from '@/shared/lib/attemptFormat';
import { AttemptPracticeActions } from '@/features/practice/components/AttemptPracticeActions';
import type { PracticeMode } from '@/features/practice/types/practice';
import type { HistoryItem } from '@/features/history/types/history';
import { resolveHistoryTitle } from '@/features/history/utils/historyCard';
import type { ExamResultPayload, Question } from '../types/exam';
import { buildQuestionReportData } from '../utils/questionReport';

type ResultDetailItem = {
  question_id: string;
  selected_option?: string | number | null;
  selected_option_id?: string | number | null;
  selected_option_text?: string | null;
  correct_option_id?: string | null;
  correct_option_text?: string | null;
  is_correct?: boolean | null;
  marks_awarded?: number;
  status?: 'correct' | 'wrong' | 'skipped' | 'question_not_found' | string;
};

type AnalysisState = (ExamResultPayload & { historySummary?: HistoryItem }) | { historySummary: HistoryItem } | null;

type QuestionFilter = 'all' | 'correct' | 'wrong' | 'skipped' | 'bookmarked';

interface AttemptSummary {
  title: string;
  submittedAt: string | null;
  timeTaken: number;
  score: number;
  totalMarks: number;
  correct: number;
  wrong: number;
  skipped: number;
  rank: number | null;
  practiceMode: PracticeMode | null;
  isTimeout: boolean;
}

const getSafeDetailsJson = (result: ExamResultPayload | null): any => {
  const raw: unknown = result?.details_json;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? raw : {};
};

const hasUsableDetails = (result: ExamResultPayload | null): boolean => {
  const details = getSafeDetailsJson(result);
  return (
    (Array.isArray(details.questions) && details.questions.length > 0) ||
    (Array.isArray(details.details) && details.details.length > 0)
  );
};

const Analysis: React.FC = () => {
  const { language, t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();

  const locationState = (location.state as AnalysisState) ?? null;
  const stateResult =
    locationState && 'details_json' in locationState
      ? (locationState as ExamResultPayload)
      : null;
  const stateHistory =
    locationState && 'historySummary' in locationState
      ? (locationState as { historySummary: HistoryItem }).historySummary
      : null;

  const [result, setResult] = useState<ExamResultPayload | null>(
    hasUsableDetails(stateResult) ? stateResult : null
  );
  const [historySummary, setHistorySummary] = useState<HistoryItem | null>(stateHistory);
  const [isLoading, setIsLoading] = useState(!hasUsableDetails(stateResult));
  const [loadFailed, setLoadFailed] = useState(false);
  const [filter, setFilter] = useState<QuestionFilter>('all');
  const [reloadToken, setReloadToken] = useState(0);
  const loadAttemptedRef = useRef<string | null>(null);

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportQuestionData, setReportQuestionData] = useState<QuestionMetaData | null>(null);

  useEffect(() => {
    if (hasUsableDetails(result)) {
      setIsLoading(false);
      return;
    }

    if (!id) {
      setIsLoading(false);
      setLoadFailed(true);
      return;
    }

    // One load per id: a result without a question snapshot must not re-trigger
    // the effect on every render.
    if (loadAttemptedRef.current === id) return;
    loadAttemptedRef.current = id;

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setLoadFailed(false);

      const [resultOutcome, historyOutcome] = await Promise.allSettled([
        apiClient.get(`/exams/user/result/${id}`),
        historySummary ? Promise.resolve(null) : apiClient.get('/history/exams'),
      ]);

      if (cancelled) return;

      const fetched =
        resultOutcome.status === 'fulfilled' ? resultOutcome.value?.data?.data : null;

      if (fetched) {
        setResult(fetched as ExamResultPayload);
      }

      if (
        !historySummary &&
        historyOutcome.status === 'fulfilled' &&
        historyOutcome.value
      ) {
        const list = historyOutcome.value?.data?.data;
        const found = Array.isArray(list)
          ? (list as HistoryItem[]).find((item) => item.id === id)
          : null;
        if (found) setHistorySummary(found);
      }

      if (!fetched) setLoadFailed(true);
      setIsLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [id, result, historySummary, reloadToken]);

  const retryLoad = useCallback(() => {
    loadAttemptedRef.current = null;
    setReloadToken((token) => token + 1);
  }, []);

  // A result opened straight from submission carries the questions but not the
  // paper title. The history summary supplies it without touching details_json.
  useEffect(() => {
    if (historySummary || !result?.id) return;

    let cancelled = false;

    apiClient
      .get('/history/exams')
      .then((response) => {
        if (cancelled) return;
        const list = response?.data?.data;
        const found = Array.isArray(list)
          ? (list as HistoryItem[]).find((item) => item.id === result.id)
          : null;
        if (found) setHistorySummary(found);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [historySummary, result?.id]);

  const detailsJson = getSafeDetailsJson(result);

  const examQuestions: Question[] = Array.isArray(detailsJson.questions)
    ? detailsJson.questions
    : [];
  const resultDetails: ResultDetailItem[] = Array.isArray(detailsJson.details)
    ? detailsJson.details
    : [];

  const userAnswers: Record<string, string> =
    detailsJson.userAnswers &&
    typeof detailsJson.userAnswers === 'object' &&
    !Array.isArray(detailsJson.userAnswers)
      ? detailsJson.userAnswers
      : detailsJson.answers && typeof detailsJson.answers === 'object' && !Array.isArray(detailsJson.answers)
        ? detailsJson.answers
        : {};

  const summary: AttemptSummary | null = useMemo(() => {
    const source = result ?? historySummary;
    if (!source) return null;

    const historyItem =
      historySummary ??
      (result
        ? ({
            id: result.id,
            score: result.score,
            total_marks: result.total_marks,
            correct_count: result.correct_count,
            wrong_count: result.wrong_count,
            skipped_count: result.skipped_count,
            exam_id: result.exam_id ?? null,
          } as HistoryItem)
        : null);

    if (!historyItem) return null;

    return {
      title: resolveHistoryTitle(historyItem, language, t).title,
      submittedAt:
        historyItem.submitted_at ||
        historyItem.created_at ||
        historyItem.taken_at ||
        source.submitted_at ||
        source.created_at ||
        null,
      timeTaken: Number(source.time_taken ?? 0),
      score: Number(source.score ?? 0),
      totalMarks: Number(source.total_marks ?? 0),
      correct: Number(source.correct_count ?? 0),
      wrong: Number(source.wrong_count ?? 0),
      skipped: Number(source.skipped_count ?? 0),
      rank: typeof source.rank === 'number' ? source.rank : null,
      practiceMode: historyItem.practice_mode ?? source.practice_mode ?? null,
      isTimeout: Boolean(source.is_timeout),
    };
  }, [result, historySummary, language, t]);

  const bookmarksQuery = useQuery({
    queryKey: ['exams', 'bookmarks'],
    queryFn: async () => {
      const response = await apiClient.get('/exams/bookmark');
      const ids = response?.data?.data?.question_ids;
      return Array.isArray(ids)
        ? ids.filter((questionId): questionId is string => typeof questionId === 'string')
        : [];
    },
    enabled: Boolean(result),
    staleTime: 30 * 1000,
  });

  const bookmarkMutation = useMutation({
    mutationFn: async (payload: { questionId: string; bookmarked: boolean }) => {
      const response = await apiClient.post('/exams/bookmark', payload);
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData<string[]>(['exams', 'bookmarks'], (current) => {
        const next = new Set(current ?? []);
        if (variables.bookmarked) next.add(variables.questionId);
        else next.delete(variables.questionId);
        return Array.from(next);
      });
      queryClient.invalidateQueries({ queryKey: ['history', 'bookmarks'] });
      queryClient.invalidateQueries({ queryKey: ['question-bank', 'questions'] });
      toast.success(data?.message || t('exam.bookmarkUpdated'));
    },
    onError: () => {
      toast.error(t('exam.bookmarkFailed'));
    },
  });

  const reportMutation = useMutation({
    mutationFn: async (payload: ModalReportPayload) => {
      const response = await apiClient.post('/reports', payload);
      return response.data;
    },
    onSuccess: () => toast.success(t('exam.reportSubmitted')),
    onError: () => toast.error(t('exam.reportSubmitFailed')),
  });

  const resultBookmarkedIds: string[] = Array.isArray(detailsJson.bookmarked_ids)
    ? detailsJson.bookmarked_ids
    : [];
  const bookmarkedIds = useMemo(
    () =>
      new Set(
        bookmarksQuery.isSuccess ? bookmarksQuery.data : resultBookmarkedIds
      ),
    [bookmarksQuery.isSuccess, bookmarksQuery.data, resultBookmarkedIds]
  );

  const detailsByQuestionId = useMemo(
    () => new Map(resultDetails.map((detail) => [String(detail.question_id), detail])),
    [resultDetails]
  );

  const showCorrectAnswers = detailsJson.correct_answers_revealed !== false;

  const getSelectedAnswerId = useCallback(
    (questionId: string): string | undefined => {
      const detail = detailsByQuestionId.get(String(questionId));
      const selected =
        detail?.selected_option ?? userAnswers[String(questionId)] ?? userAnswers[questionId];

      if (selected === null || selected === undefined || String(selected).trim() === '') {
        return undefined;
      }
      return String(selected);
    },
    [detailsByQuestionId, userAnswers]
  );

  const statusFor = useCallback(
    (questionId: string): string | undefined => {
      const detail = detailsByQuestionId.get(String(questionId));
      if (detail?.status) return detail.status;
      if (detail?.is_correct === true) return 'correct';
      if (detail?.is_correct === false) return 'wrong';
      if (detail && !getSelectedAnswerId(questionId)) return 'skipped';
      return undefined;
    },
    [detailsByQuestionId, getSelectedAnswerId]
  );

  const filteredQuestions = useMemo(() => {
    if (filter === 'all') return examQuestions;
    if (filter === 'bookmarked') {
      return examQuestions.filter((question) => bookmarkedIds.has(question.id));
    }
    return examQuestions.filter((question) => {
      const status = statusFor(question.id);
      if (filter === 'correct') return status === 'correct';
      if (filter === 'wrong') return status === 'wrong';
      return (
        status === 'skipped' ||
        (status === undefined && !getSelectedAnswerId(question.id))
      );
    });
  }, [examQuestions, filter, bookmarkedIds, statusFor, getSelectedAnswerId]);

  const handleBookmark = useCallback(
    async (questionId: string, bookmarked: boolean) => {
      await bookmarkMutation.mutateAsync({ questionId, bookmarked });
    },
    [bookmarkMutation]
  );

  const handleReport = useCallback(
    (questionId: string) => {
      const question = examQuestions.find((item) => String(item.id) === String(questionId));
      setReportQuestionData(
        question
          ? buildQuestionReportData(question, language, result?.exam_id ?? undefined)
          : { questionId }
      );
      setIsReportModalOpen(true);
    },
    [examQuestions, language, result?.exam_id]
  );

  const handleCloseModal = useCallback(() => {
    setIsReportModalOpen(false);
    setReportQuestionData(null);
  }, []);

  const handleSubmitReport = useCallback(
    async (data: ModalReportPayload) => {
      await reportMutation.mutateAsync(data);
    },
    [reportMutation]
  );

  const goBack = useCallback(() => {
    if (location.key === 'default') {
      navigate('/history', { replace: true });
      return;
    }
    navigate(-1);
  }, [location.key, navigate]);

  const outcomeText = useMemo(() => {
    if (!summary) return '';
    const total = summary.correct + summary.wrong + summary.skipped;
    if (total > 0 && summary.skipped === total) return t('analysis.outcomeAllSkipped');
    if (summary.correct === 0) return t('analysis.outcomeZero');
    const accuracy = total > 0 ? (summary.correct / total) * 100 : 0;
    if (accuracy < 40) return t('analysis.outcomeLow');
    if (accuracy < 75) return t('analysis.outcomeMid');
    return t('analysis.outcomeHigh');
  }, [summary, t]);

  const filters: { id: QuestionFilter; label: string }[] = [
    { id: 'all', label: t('analysis.filterAll') },
    { id: 'correct', label: t('analysis.correct') },
    { id: 'wrong', label: t('analysis.wrong') },
    { id: 'skipped', label: t('analysis.skipped') },
    { id: 'bookmarked', label: t('analysis.filterBookmarked') },
  ];

  if (isLoading && !summary) {
    return (
      <div className="min-h-screen bg-app px-4 pb-32 pt-4">
        <div className="mx-auto w-full max-w-2xl space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-40 rounded-[20px]" />
          <Skeleton className="h-10 w-full rounded-xl" />
          {[1, 2].map((row) => (
            <Skeleton key={row} className="h-56 rounded-[20px]" />
          ))}
        </div>
      </div>
    );
  }

  if (!summary && loadFailed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-app px-6 text-center">
        <p className="text-[15px] font-bold text-text-primary">{t('history.errorTitle')}</p>
        <p className="mt-1 text-[13px] leading-6 text-text-secondary">
          {t('history.errorMessage')}
        </p>
        <button
          type="button"
          onClick={goBack}
          className="mt-5 min-h-[44px] rounded-xl bg-primary px-6 text-[13px] font-bold text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          {t('analysis.back')}
        </button>
      </div>
    );
  }

  if (!summary) return null;

  const questionCount = examQuestions.length;
  const counted = summary.correct + summary.wrong + summary.skipped;
  const retakeCount = Math.max(counted, questionCount);
  const practiceCount = summary.wrong + summary.skipped;
  const hasReview = questionCount > 0;
  const hasDetailFallback = !hasReview && resultDetails.length > 0;

  return (
    <div className={`min-h-screen bg-app pb-44 ${language === 'bn' ? 'font-bengali' : 'font-sans'}`}>
      <header className="px-4 pb-3 pt-2">
        <div className="mx-auto w-full max-w-2xl">
          <button
            type="button"
            onClick={goBack}
            aria-label={t('analysis.backAria')}
            className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <ArrowLeft size={21} aria-hidden="true" />
          </button>

          <h1 className="mt-1 line-clamp-2 text-xl font-bold leading-7 text-text-primary">
            {summary.title}
          </h1>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] leading-4 text-text-secondary">
            <span>
              {[formatAttemptDate(summary.submittedAt, language), summary.isTimeout ? t('analysis.timeout') : '']
                .filter(Boolean)
                .join(' · ')}
            </span>
            {summary.practiceMode ? (
              <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-semibold leading-4">
                {summary.practiceMode === 'retake'
                  ? t('practice.retakeBadge')
                  : t('history.badgePractice')}
              </span>
            ) : null}
          </div>

          {outcomeText ? (
            <p className="mt-3 text-[13px] leading-6 text-text-secondary">{outcomeText}</p>
          ) : null}
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl space-y-4 px-4">
        <ResultSummary
          score={summary.score}
          totalMarks={summary.totalMarks}
          correct={summary.correct}
          wrong={summary.wrong}
          skipped={summary.skipped}
          timeTaken={summary.timeTaken}
          rank={summary.rank}
        />

        {isLoading ? (
          <div className="space-y-3" role="status" aria-label={t('history.loading')}>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-11 w-full rounded-xl" />
            {[1, 2].map((row) => (
              <Skeleton key={row} className="h-56 rounded-[20px]" />
            ))}
          </div>
        ) : loadFailed ? (
          <div className="rounded-[20px] bg-card-bg px-5 py-8 text-center">
            <p className="text-[13px] font-semibold text-text-primary">
              {t('history.errorTitle')}
            </p>
            <p className="mt-1 text-[12px] leading-5 text-text-secondary">
              {t('history.errorMessage')}
            </p>
            <button
              type="button"
              onClick={retryLoad}
              className="mt-4 min-h-[44px] rounded-xl bg-primary px-5 text-[12px] font-bold text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {t('history.retry')}
            </button>
          </div>
        ) : hasReview ? (
          <>
            <div className="flex items-center justify-between gap-3 px-1">
              <h2 className="text-[15px] font-bold leading-6 text-text-primary">
                {t('analysis.questionsTitle')}
              </h2>
              <span className="text-[11px] leading-4 text-text-secondary">
                {t('analysis.questionsCount', {
                  count: formatCount(questionCount, language),
                })}
              </span>
            </div>

            <div
              role="group"
              aria-label={t('analysis.questionsTitle')}
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {filters.map((option) => {
                const active = filter === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setFilter(option.id)}
                    aria-pressed={active}
                    className={`min-h-[44px] shrink-0 rounded-full px-4 text-[12px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card-bg text-text-secondary'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            {filteredQuestions.length > 0 ? (
              <div className="space-y-3">
                {filteredQuestions.map((question) => {
                  const index = examQuestions.findIndex((item) => item.id === question.id);
                  return (
                    <AnalysisQuestionCard
                      key={question.id}
                      index={index >= 0 ? index : 0}
                      question={question}
                      userAnswerId={getSelectedAnswerId(question.id)}
                      status={statusFor(question.id)}
                      showCorrectAnswers={showCorrectAnswers}
                      initialBookmarked={bookmarkedIds.has(question.id)}
                      onReport={handleReport}
                      onBookmark={handleBookmark}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[20px] bg-card-bg px-5 py-10 text-center">
                <p className="text-[13px] font-semibold text-text-primary">
                  {t('analysis.filterEmptyTitle')}
                </p>
                <p className="mt-1 text-[12px] leading-5 text-text-secondary">
                  {t('analysis.filterEmptyBody')}
                </p>
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className="mt-4 min-h-[44px] rounded-xl bg-surface-elevated px-5 text-[12px] font-semibold text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  {t('analysis.filterAll')}
                </button>
              </div>
            )}
          </>
        ) : hasDetailFallback ? (
          <section className="rounded-[20px] bg-card-bg p-4">
            <h2 className="text-[15px] font-bold leading-6 text-text-primary">
              {t('analysis.answerSummaryTitle')}
            </h2>
            <p className="mt-1 text-[12px] leading-5 text-text-secondary">
              {t('analysis.detailsUnavailable')}
            </p>
            <ul className="mt-3 space-y-2">
              {resultDetails.map((detail, index) => (
                <li
                  key={`${detail.question_id}-${index}`}
                  className="flex items-start justify-between gap-3 rounded-xl bg-surface px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-text-secondary">
                      {t('analysis.questionNumber', {
                        index: formatCount(index + 1, language),
                      })}
                    </p>
                    <p className="mt-0.5 text-[12px] leading-5 text-text-primary">
                      {detail.selected_option_text?.trim() || t('analysis.notAnswered')}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] font-semibold text-text-secondary">
                    {detail.status === 'correct'
                      ? t('analysis.correct')
                      : detail.status === 'wrong'
                        ? t('analysis.wrong')
                        : t('analysis.skipped')}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <div className="rounded-[20px] bg-card-bg px-5 py-10 text-center">
            <p className="text-[15px] font-bold text-text-primary">
              {t('analysis.noDetails')}
            </p>
            <p className="mt-1 text-[12px] leading-5 text-text-secondary">
              {t('analysis.noDetailsBody')}
            </p>
          </div>
        )}
      </div>

      {id ? (
        <AttemptPracticeActions
          historyId={id}
          retakeCount={retakeCount}
          wrongCount={practiceCount}
        />
      ) : null}

      {isReportModalOpen && reportQuestionData ? (
        <ReportModal
          isOpen={isReportModalOpen}
          onClose={handleCloseModal}
          type="question_issue"
          questionData={reportQuestionData}
          onSubmit={handleSubmitReport}
        />
      ) : null}
    </div>
  );
};

export default Analysis;
