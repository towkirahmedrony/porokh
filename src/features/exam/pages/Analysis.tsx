import React, { useEffect, useState, useCallback, memo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AnalysisQuestionCard from '../components/AnalysisQuestionCard';
import ReportModal, {
  QuestionMetaData,
  ReportPayload as ModalReportPayload,
} from '@/shared/components/feedback/ReportModal';
import { apiClient } from '@/shared/lib/apiClient';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { ExamResultPayload, Question } from '../types/exam';
import toast from 'react-hot-toast';
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  Trophy,
  ArrowLeft,
  Home,
  HelpCircle,
} from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import type { AppMessageKey } from '@/shared/i18n/messages';
import { buildQuestionReportData } from '../utils/questionReport';

type TranslateFn = (key: AppMessageKey) => string;

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

const ActionButtons = memo(({ onHome, onBack }: { onHome: () => void; onBack: () => void }) => {
  const { t } = useLanguage();
  return (
  <>
    <button
      type="button"
      onClick={onHome}
      className="flex-1 font-bold py-3.5 md:py-4 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 text-sm md:text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring bg-secondary text-text-primary border border-border-color"
    >
      <Home size={18} />
      {t('analysis.home')}
    </button>

    <button
      type="button"
      onClick={onBack}
      className="flex-1 font-bold py-3.5 md:py-4 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 text-sm md:text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring bg-primary text-primary-foreground"
    >
      <ArrowLeft size={18} />
      {t('analysis.back')}
    </button>
  </>
  );
});
ActionButtons.displayName = 'ActionButtons';

const getSafeDetailsJson = (result: any) => {
  const raw = result?.details_json;

  if (!raw) return {};

  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  if (typeof raw === 'object') return raw;

  return {};
};

const getStatusText = (item: ResultDetailItem, t: TranslateFn) => {
  if (item.status === 'question_not_found') return t('analysis.questionNotFound');
  if (item.status === 'skipped' || item.is_correct === null) return t('analysis.skipped');
  if (item.is_correct === true || item.status === 'correct') return t('analysis.correct');
  if (item.is_correct === false || item.status === 'wrong') return t('analysis.wrong');
  return t('analysis.unknown');
};

const getStatusIcon = (item: ResultDetailItem) => {
  if (item.status === 'question_not_found') {
    return <HelpCircle size={22} className="text-text-secondary" />;
  }

  if (item.status === 'skipped' || item.is_correct === null) {
    return <MinusCircle size={22} className="text-text-secondary" />;
  }

  if (item.is_correct === true || item.status === 'correct') {
    return <CheckCircle2 size={22} className="text-text-primary" />;
  }

  if (item.is_correct === false || item.status === 'wrong') {
    return <XCircle size={22} className="text-text-primary" />;
  }

  return <HelpCircle size={22} className="text-text-secondary" />;
};

const getStatusCardClass = (item: ResultDetailItem) => {
  if (item.status === 'skipped' || item.is_correct === null) {
    return 'border-border-color bg-surface';
  }

  if (item.is_correct === true || item.status === 'correct') {
    return 'border-border-color bg-surface';
  }

  if (item.is_correct === false || item.status === 'wrong') {
    return 'border-border-color bg-surface';
  }

  return 'border-border-color bg-surface';
};

const Analysis: React.FC = () => {
  const { language, t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();

  const stateResult = (location.state as ExamResultPayload) || null;
  const stateHasDetails = Boolean(
    stateResult?.details_json &&
      ((Array.isArray(stateResult.details_json.questions) &&
        stateResult.details_json.questions.length > 0) ||
        (Array.isArray(stateResult.details_json.details) &&
          stateResult.details_json.details.length > 0))
  );

  const [result, setResult] = useState<ExamResultPayload | null>(
    stateHasDetails ? stateResult : null
  );
  const [isLoading, setIsLoading] = useState(!stateHasDetails);

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportQuestionData, setReportQuestionData] = useState<QuestionMetaData | null>(null);

  useEffect(() => {
    if (result) {
      setIsLoading(false);
      return;
    }

    if (!id) {
      navigate('/dashboard/home', { replace: true });
      return;
    }

    let cancelled = false;

    const loadResult = async () => {
      try {
        try {
          const res = await apiClient.get(`/exams/user/result/${id}`);
          const fetched = res?.data?.data;

          if (!cancelled && fetched) {
            setResult(fetched);
            return;
          }
        } catch {
          // Fall back to the history list below (older backend deployments).
        }

        try {
          const res = await apiClient.get('/history/exams');
          const historyList = res?.data?.data;
          const found = Array.isArray(historyList)
            ? historyList.find(
                (item: ExamResultPayload) => item && (item.id === id || item.exam_id === id)
              )
            : null;

          if (cancelled) return;

          if (found) {
            setResult(found);
            return;
          }

          toast.error(t('exam.resultsLoadFailed'));
          navigate('/dashboard/home', { replace: true });
        } catch {
          if (!cancelled) {
            toast.error(t('exam.resultsLoadError'));
            navigate('/dashboard/home', { replace: true });
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadResult();

    return () => {
      cancelled = true;
    };
  }, [result, id, navigate, t]);

  const reportMutation = useMutation({
    mutationFn: async (payload: ModalReportPayload) => {
      const response = await apiClient.post('/reports', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success(t('exam.reportSubmitted'));
    },
    onError: () => {
      toast.error(t('exam.reportSubmitFailed'));
    },
  });

  const bookmarkMutation = useMutation({
    mutationFn: async (payload: { questionId: string; bookmarked: boolean }) => {
      const response = await apiClient.post('/exams/bookmark', payload);
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData<string[]>(['exams', 'bookmarks'], (current) => {
        const next = new Set(current ?? []);
        if (variables.bookmarked) {
          next.add(variables.questionId);
        } else {
          next.delete(variables.questionId);
        }
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

  const handleReport = useCallback((questionId: string) => {
    const details = getSafeDetailsJson(result);
    const questions = Array.isArray(details.questions)
      ? (details.questions as Question[])
      : [];
    const question = questions.find(
      (item) => String(item?.id) === String(questionId)
    );

    setReportQuestionData(
      question
        ? buildQuestionReportData(question, language, result?.exam_id ?? undefined)
        : { questionId }
    );
    setIsReportModalOpen(true);
  }, [result, language]);

  const handleBookmark = useCallback(
    async (questionId: string, bookmarked: boolean) => {
      await bookmarkMutation.mutateAsync({ questionId, bookmarked });
    },
    [bookmarkMutation]
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

  const handleHomeNav = useCallback(() => navigate('/dashboard/home'), [navigate]);
  const handleBackNav = useCallback(() => navigate(-1), [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen pb-28 flex flex-col items-center bg-app">
        <div className="w-full pt-6 pb-8 px-4 border-b border-card-border bg-card-bg">
          <div className="max-w-3xl mx-auto flex flex-col items-center">
            <Skeleton className="w-14 h-14 rounded-full mb-4 opacity-50" />
            <Skeleton className="w-48 h-8 rounded-lg mb-6 opacity-50" />

            <div className="grid grid-cols-3 gap-3 md:gap-5 w-full mb-6">
              <Skeleton className="h-28 rounded-xl opacity-40" />
              <Skeleton className="h-28 rounded-xl opacity-40" />
              <Skeleton className="h-28 rounded-xl opacity-40" />
            </div>

            <Skeleton className="w-32 h-12 rounded-xl opacity-50" />
          </div>
        </div>

        <div className="w-full max-w-3xl px-4 mt-8 space-y-5">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl overflow-hidden border border-card-border p-4 sm:p-5 bg-card-bg"
            >
              <div className="flex justify-between items-center mb-5 pb-4 border-b border-border-color">
                <Skeleton className="w-12 h-6 rounded-md opacity-40" />
                <Skeleton className="w-24 h-6 rounded-md opacity-40" />
              </div>

              <Skeleton className="w-3/4 h-5 rounded-md mb-6 opacity-50" />

              <div className="space-y-3">
                <Skeleton className="w-full h-12 rounded-xl opacity-40" />
                <Skeleton className="w-full h-12 rounded-xl opacity-40" />
                <Skeleton className="w-full h-12 rounded-xl opacity-40" />
                <Skeleton className="w-full h-12 rounded-xl opacity-40" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!result) return null;

  const detailsJson = getSafeDetailsJson(result);

  const examQuestions: Question[] = Array.isArray(detailsJson.questions)
    ? detailsJson.questions
    : [];

  const resultDetails: ResultDetailItem[] = Array.isArray(detailsJson.details)
    ? detailsJson.details
    : [];

  const userAnswers: Record<string, string> =
    detailsJson.userAnswers && typeof detailsJson.userAnswers === 'object' && !Array.isArray(detailsJson.userAnswers)
      ? detailsJson.userAnswers
      : detailsJson.answers && typeof detailsJson.answers === 'object' && !Array.isArray(detailsJson.answers)
        ? detailsJson.answers
        : {};

  const resultBookmarkedIds: string[] = Array.isArray(detailsJson.bookmarked_ids)
    ? detailsJson.bookmarked_ids
    : [];
  const bookmarkedIds = new Set(
    bookmarksQuery.isSuccess ? bookmarksQuery.data : resultBookmarkedIds
  );

  const detailsByQuestionId = new Map<string, ResultDetailItem>(
    resultDetails.map((detail) => [String(detail.question_id), detail])
  );

  const showCorrectAnswers = detailsJson.correct_answers_revealed !== false;

  const getSelectedAnswerId = (questionId: string): string | undefined => {
    const detail = detailsByQuestionId.get(String(questionId));
    const selected = detail?.selected_option ?? userAnswers[String(questionId)] ?? userAnswers[questionId];

    if (selected === null || selected === undefined || String(selected).trim() === '') {
      return undefined;
    }

    return String(selected);
  };

  return (
    <div className="min-h-screen flex flex-col items-center bg-app text-text-primary">
      <div className="w-full pt-6 pb-8 px-4 border-b shadow-sm relative overflow-hidden bg-card-bg border-card-border">
        <div className="absolute top-0 left-0 w-full h-1 opacity-50 bg-primary" />

        <div className="max-w-3xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center justify-center p-3 rounded-full mb-4 shadow-inner bg-accent text-text-primary">
            <Trophy size={28} strokeWidth={2} />
          </div>

          <h2 className="text-xl md:text-2xl font-bold mb-6 font-['Noto_Sans_Bengali'] text-text-primary">
            {t('analysis.title')}
          </h2>

          <div className="grid grid-cols-3 gap-3 md:gap-5 mb-6">
            <div className="flex flex-col items-center p-3 md:p-4 rounded-xl border border-border-color bg-surface transition-transform hover:scale-[1.02]">
              <CheckCircle2 className="text-text-primary mb-1.5" size={24} />
              <span className="text-xs md:text-sm font-semibold text-text-secondary opacity-90">
                {t('analysis.correct')}
              </span>
              <span className="text-xl md:text-2xl font-bold text-text-primary">
                {result.correct_count ?? 0}
              </span>
            </div>

            <div className="flex flex-col items-center p-3 md:p-4 rounded-xl border border-border-color bg-surface transition-transform hover:scale-[1.02]">
              <XCircle className="text-text-primary mb-1.5" size={24} />
              <span className="text-xs md:text-sm font-semibold text-text-secondary opacity-90">
                {t('analysis.wrong')}
              </span>
              <span className="text-xl md:text-2xl font-bold text-text-primary">
                {result.wrong_count ?? 0}
              </span>
            </div>

            <div className="flex flex-col items-center p-3 md:p-4 rounded-xl border border-border-color bg-surface transition-transform hover:scale-[1.02]">
              <MinusCircle className="text-text-primary mb-1.5" size={24} />
              <span className="text-xs md:text-sm font-semibold text-text-secondary opacity-90">
                {t('analysis.skipped')}
              </span>
              <span className="text-xl md:text-2xl font-bold text-text-primary">
                {result.skipped_count ?? 0}
              </span>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border shadow-sm font-mono text-lg md:text-xl bg-surface border-border-color">
            <span className="font-semibold opacity-70 text-sm md:text-base font-['Noto_Sans_Bengali'] text-text-secondary">
              {t('analysis.score')}
            </span>
            <span className="font-bold text-text-primary">
              {result.score ?? 0} / {result.total_marks ?? 0}
            </span>
          </div>
        </div>
      </div>

      <div className="w-full max-w-3xl px-4 mt-8 space-y-5">
        {examQuestions.length > 0 ? (
          examQuestions.map((q: Question, idx: number) => (
            <AnalysisQuestionCard
              key={q.id}
              index={idx}
              question={q}
              userAnswerId={getSelectedAnswerId(q.id)}
              status={detailsByQuestionId.get(String(q.id))?.status}
              showCorrectAnswers={showCorrectAnswers}
              initialBookmarked={bookmarkedIds.has(q.id)}
              onReport={handleReport}
              onBookmark={handleBookmark}
            />
          ))
        ) : resultDetails.length > 0 ? (
          <>
            <div className="rounded-2xl border border-border-color bg-card-bg p-4">
              <h3 className="font-bold text-lg mb-1">{t('analysis.answerSummaryTitle')}</h3>
              <p className="text-sm text-text-secondary opacity-80">
                {t('analysis.detailsUnavailable')}
              </p>
            </div>

            {resultDetails.map((item, idx) => {
              const selectedOption = item.selected_option ?? item.selected_option_id ?? null;
              const hasSelectedOption =
                selectedOption !== null &&
                selectedOption !== undefined &&
                String(selectedOption).trim() !== '';

              const selectedAnswerText = item.selected_option_text?.trim()
                ? item.selected_option_text
                : hasSelectedOption
                  ? t('analysis.answerSavedNoDetails')
                  : t('analysis.notAnswered')

              const correctAnswerText = showCorrectAnswers
                ? item.correct_option_text?.trim() || null
                : null;

              return (
                <div
                  key={`${item.question_id}-${idx}`}
                  className={`rounded-2xl border p-4 sm:p-5 ${getStatusCardClass(item)}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <p className="text-xs font-semibold text-text-secondary mb-1">
                        {t('analysis.questionNumber', { index: idx + 1 })}
                      </p>
                      <p className="text-sm text-text-secondary opacity-80">
                        {t('analysis.questionMissing')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border-color bg-card-bg text-sm font-bold">
                      {getStatusIcon(item)}
              {getStatusText(item, t)}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border-color bg-card-bg p-3">
                      <p className="text-xs text-text-secondary mb-1">{t('analysis.yourAnswer')}</p>
                      <p className="font-bold">{selectedAnswerText}</p>
                    </div>

                    <div className="rounded-xl border border-border-color bg-card-bg p-3">
                      <p className="text-xs text-text-secondary mb-1">{t('analysis.marks')}</p>
                      <p className="font-bold">{item.marks_awarded ?? 0}</p>
                    </div>

                    {correctAnswerText && (
                      <div className="rounded-xl border border-border-color bg-card-bg p-3 sm:col-span-2">
                        <p className="text-xs text-text-secondary mb-1">{t('analysis.correctAnswer')}</p>
                        <p className="font-bold">{correctAnswerText}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => handleReport(item.question_id)}
                      className="px-4 py-2 rounded-xl border border-border-color bg-card-bg text-sm font-semibold active:scale-95 transition-all"
                    >
                      {t('analysis.report')}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        void handleBookmark(
                          item.question_id,
                          !bookmarkedIds.has(item.question_id)
                        ).catch(() => undefined);
                      }}
                      className="px-4 py-2 rounded-xl border border-border-color bg-card-bg text-sm font-semibold active:scale-95 transition-all"
                    >
                      {t('analysis.bookmark')}
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <div className="text-center py-16 px-4 rounded-2xl border border-dashed flex flex-col items-center border-border-color">
            <div className="w-16 h-16 rounded-full mb-4 flex items-center justify-center bg-surface-elevated">
              <MinusCircle size={32} className="opacity-40" />
            </div>

            <h3 className="text-lg font-bold opacity-80 mb-1">{t('analysis.noDetails')}</h3>
            <p className="text-sm opacity-60">
              {t('analysis.noDetailsBody')}
            </p>
          </div>
        )}
      </div>

      <div className="hidden md:flex w-full max-w-3xl px-4 mt-12 mb-16 gap-4 justify-center">
        <ActionButtons onHome={handleHomeNav} onBack={handleBackNav} />
      </div>

      <div className="md:hidden fixed bottom-0 left-0 w-full p-4 z-40 border-t flex justify-center bg-surface border-border-color">
        <div className="w-full max-w-3xl flex gap-3">
          <ActionButtons onHome={handleHomeNav} onBack={handleBackNav} />
        </div>
      </div>

      <div className="h-24 md:hidden w-full" />

      {isReportModalOpen && reportQuestionData && (
        <ReportModal
          isOpen={isReportModalOpen}
          onClose={handleCloseModal}
          type="question_issue"
          questionData={reportQuestionData}
          onSubmit={handleSubmitReport}
        />
      )}
    </div>
  );
};

export default Analysis;
