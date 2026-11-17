import React, { useState, useEffect, useCallback, memo, useRef, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import LiveQuestionCard from '../components/LiveQuestionCard';
import ExamTimer from '../components/ExamTimer';
import ExamHeader from '../components/ExamHeader';

import ReportModal, { ReportPayload as ModalReportPayload } from '@/shared/components/feedback/ReportModal';
import ConfirmModal from '@/shared/components/feedback/ConfirmModal';
import { apiClient } from '@/shared/lib/apiClient';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { beginExamActivity } from '@/features/app-update/examActivity';
import type { AppMessageKey } from '@/shared/i18n/messages';
import { getLocalized, pickLang } from '@/shared/i18n/localize';
import MathDisplay from '@/shared/components/content/MathDisplay';
import toast from 'react-hot-toast';
import { ExamConfig, ExamQuestion, Question } from '../types/exam';
import { practiceService, resolvePracticeError } from '@/features/practice/services/practiceService';
import { buildQuestionReportData } from '../utils/questionReport';
import {
  clampQuestionIndex,
  findFirstUnansweredQuestionIndex,
  normalizeAttemptAnswers,
} from '@/features/practice/utils/practice';
import type { PracticeAnswerReveal, PracticeMode } from '@/features/practice/types/practice';
import { AlertCircle, CheckCircle, ChevronRight, SkipForward, XCircle } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import {
  buildSubmissionStorageKey,
  buildSubmitPayload,
  clearSubmissionId,
  extractSubmittedResultId,
  getOrCreateSubmissionId,
  resolveSubmitErrorMessage,
} from '../utils/examSubmission';
import { postExamSubmission } from '../utils/examSubmissionRequest';
import { useOfflineExam } from '@/features/exam/offline/useOfflineExam';

const defaultConfig: ExamConfig = {
  questionCount: 10,
  duration: 20,
  negativeMarking: true,
};

const PRACTICE_TITLES: Record<PracticeMode, AppMessageKey> = {
  retake: 'practice.retakeTitle',
  wrong_from_history: 'practice.wrongTitle',
  wrong_global: 'practice.globalTitle',
};

type ArenaQuestion = ExamQuestion | Question;

type ArenaQuestionResponse = {
  success?: boolean;
  data?: ExamQuestion[];
};

type SubmitExamResponse = {
  success?: boolean;
  data?: any;
};

type ExtendedExamConfig = ExamConfig & {
  examId?: string;
  exam_id?: string;
  sessionId?: string;
  session_id?: string;
};

type ExamQuestionListProps = {
  questions: ArenaQuestion[];
  userAnswers: Record<string, string>;
  onSelectOption: (questionId: string, optionId: string) => void;
  onReport: (questionId: string) => void;
};

/**
 * Module-level memo keeps the timer tick from re-rendering every question card.
 * `content-visibility` skips layout/paint work for cards outside the viewport.
 */
const ExamQuestionList = memo(function ExamQuestionList({
  questions,
  userAnswers,
  onSelectOption,
  onReport,
}: ExamQuestionListProps) {
  return (
    <>
      {questions.map((question, index) => (
        <div
          key={question.id}
          style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 600px' }}
        >
          <LiveQuestionCard
            question={question}
            index={index}
            selectedOptionId={userAnswers[question.id]}
            onSelectOption={onSelectOption}
            onReport={onReport}
          />
        </div>
      ))}
    </>
  );
});

const fetchArenaQuestions = async (
  limit: number,
  subjectSlug?: string
): Promise<ExamQuestion[]> => {
  const params = new URLSearchParams();
  params.set('limit', String(limit));

  if (subjectSlug) {
    params.set('subjectSlug', subjectSlug);
  }

  const res = await apiClient.get<ArenaQuestionResponse>(`/exams/user/arena?${params.toString()}`);

  return res.data?.success && Array.isArray(res.data.data) ? res.data.data : [];
};

const Arena: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { subjectSlug, attemptId } = useParams<{ subjectSlug?: string; attemptId?: string }>();
  const isAttemptMode = Boolean(attemptId);
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const offline = useOfflineExam();

  const passedConfig = location.state?.config as ExtendedExamConfig | undefined;
  const config = useMemo<ExtendedExamConfig>(() => {
    return passedConfig || defaultConfig;
  }, [passedConfig]);

  const examId = isAttemptMode ? undefined : config.examId || config.exam_id || undefined;
  const sessionId = config.sessionId || config.session_id || undefined;

  const initialDurationSeconds = config.duration * 60;

  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(initialDurationSeconds);

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportingQuestionId, setReportingQuestionId] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizReveals, setQuizReveals] = useState<Record<string, PracticeAnswerReveal>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasSubmittedRef = useRef(false);
  const quizInitializedRef = useRef<string | null>(null);
  const targetEndTimeRef = useRef<number | null>(null);
  const timeLeftRef = useRef(initialDurationSeconds);
  const lastSavedDraftRef = useRef('');
  const draftSaveInFlightRef = useRef(false);
  const queuedDraftRef = useRef<{
    answers: Record<string, string>;
    index: number;
    serialized: string;
  } | null>(null);

  // One idempotency key per examination session. It survives a reload during a
  // slow submission, so a retry is recognised by the backend as the same
  // submission instead of producing a second result.
  const submissionStorageKey = useMemo(
    () =>
      buildSubmissionStorageKey(
        isAttemptMode
          ? `attempt-${attemptId}`
          : `${subjectSlug || 'all'}-${config.questionCount}-${config.duration}`
      ),
    [isAttemptMode, attemptId, subjectSlug, config.questionCount, config.duration]
  );
  const [submissionId] = useState(() => getOrCreateSubmissionId(submissionStorageKey));

  const arenaQuestionsQuery = useQuery({
    queryKey: [
      'arenaQuestions',
      config.questionCount,
      config.duration,
      subjectSlug || 'all',
      examId || 'no-exam-id',
      sessionId || 'no-session-id',
    ],
    queryFn: () => fetchArenaQuestions(config.questionCount, subjectSlug),
    enabled: !isAttemptMode,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  const attemptStateQuery = useQuery({
    queryKey: ['practiceAttempt', attemptId],
    queryFn: () => practiceService.getAttemptState(attemptId ?? ''),
    enabled: isAttemptMode && Boolean(attemptId),
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  const attemptQuestionsQuery = useQuery({
    queryKey: ['practiceAttemptQuestions', attemptId],
    queryFn: () => practiceService.getAttemptQuestions(attemptId ?? ''),
    enabled: isAttemptMode && Boolean(attemptId),
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  const questions = useMemo<ArenaQuestion[]>(
    () =>
      isAttemptMode
        ? (attemptQuestionsQuery.data?.questions ?? [])
        : (arenaQuestionsQuery.data ?? []),
    [isAttemptMode, attemptQuestionsQuery.data, arenaQuestionsQuery.data]
  );

  // Keep OTA activation paused for the whole attempt, including submission.
  const examActivityId = `practice:${attemptId ?? sessionId ?? 'arena'}`;
  useEffect(() => {
    if (questions.length === 0) return undefined;
    return beginExamActivity(
      examActivityId,
      isSubmitting ? 'submission_pending' : 'exam_active'
    );
  }, [examActivityId, isSubmitting, questions.length]);

  const practiceMode = attemptStateQuery.data?.practice_mode ?? null;
  const isQuizMode =
    practiceMode === 'wrong_from_history' || practiceMode === 'wrong_global';

  const reportQuestionData = useMemo(() => {
    if (!reportingQuestionId) return null;

    const question = questions.find(
      (item) => String(item.id) === String(reportingQuestionId)
    );

    return question
      ? buildQuestionReportData(question, language, examId)
      : { questionId: reportingQuestionId };
  }, [questions, reportingQuestionId, language, examId]);
  const quizQuestion = questions[quizIndex] ?? questions[0];
  const quizReveal = quizQuestion ? quizReveals[quizQuestion.id] ?? null : null;
  const quizAllAnswered =
    isQuizMode && questions.length > 0 && questions.every((question) => Boolean(userAnswers[question.id]));

  const isLoading = isAttemptMode
    ? attemptStateQuery.isPending ||
      (Boolean(attemptStateQuery.data?.id) && attemptQuestionsQuery.isLoading)
    : arenaQuestionsQuery.isLoading;

  const isError = isAttemptMode
    ? attemptStateQuery.isError || attemptQuestionsQuery.isError
    : arenaQuestionsQuery.isError;

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  // Attempt mode is authoritative: the deadline and saved draft come from the
  // server, so a refresh can resume the same attempt and remaining time instead
  // of starting a fresh local timer.
  useEffect(() => {
    if (!isAttemptMode || !attemptStateQuery.data) return;

    const state = attemptStateQuery.data;
    const deadlineMs = state.deadline_at ? Date.parse(state.deadline_at) : Number.NaN;
    const fallbackSeconds = Math.max(
      0,
      Math.trunc(Number(state.seconds_remaining ?? initialDurationSeconds))
    );
    const remaining = Number.isFinite(deadlineMs)
      ? Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000))
      : fallbackSeconds;

    targetEndTimeRef.current = Number.isFinite(deadlineMs)
      ? deadlineMs
      : Date.now() + remaining * 1000;

    setTimeLeft(remaining);
    timeLeftRef.current = remaining;

    const draft = normalizeAttemptAnswers(state.answers_draft);
    setUserAnswers(draft);
    lastSavedDraftRef.current = JSON.stringify(draft);
  }, [isAttemptMode, attemptStateQuery.data, initialDurationSeconds]);

  useEffect(() => {
    if (!isQuizMode || !attemptId || questions.length === 0) return;
    if (quizInitializedRef.current === attemptId) return;

    const draft = normalizeAttemptAnswers(attemptStateQuery.data?.answers_draft);
    const start = clampQuestionIndex(
      attemptStateQuery.data?.current_question_index,
      questions.length
    );
    const firstUnanswered = findFirstUnansweredQuestionIndex(questions, draft, start);

    setQuizIndex(firstUnanswered ?? start);
    quizInitializedRef.current = attemptId;
  }, [
    isQuizMode,
    attemptId,
    questions,
    attemptStateQuery.data?.answers_draft,
    attemptStateQuery.data?.current_question_index,
  ]);

  useEffect(() => {
    if (isQuizMode || isSubmitting) return;
    if (isLoading || questions.length === 0) return;

    if (!targetEndTimeRef.current) {
      if (isAttemptMode) return;
      targetEndTimeRef.current = Date.now() + initialDurationSeconds * 1000;
    }

    const timer = window.setInterval(() => {
      const now = Date.now();
      const end = targetEndTimeRef.current || now;
      const remaining = Math.max(0, Math.ceil((end - now) / 1000));

      setTimeLeft(remaining);

      if (remaining <= 0) {
        window.clearInterval(timer);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isLoading, questions.length, initialDurationSeconds, isAttemptMode, isQuizMode, isSubmitting]);

  const persistDraft = useCallback(
    async (draft: { answers: Record<string, string>; index: number; serialized: string }) => {
      if (!attemptId) return;
      if (draftSaveInFlightRef.current) {
        queuedDraftRef.current = draft;
        return;
      }

      draftSaveInFlightRef.current = true;
      let pending: typeof draft | null = draft;

      while (pending && !hasSubmittedRef.current) {
        try {
          await practiceService.saveDraftAnswers(attemptId, pending.answers, pending.index);
          lastSavedDraftRef.current = pending.serialized;
        } catch {
          // A failed draft save must not interrupt the exam; the next answer
          // change retries, and submit always carries the full answer map.
        }

        pending = queuedDraftRef.current;
        queuedDraftRef.current = null;
      }

      draftSaveInFlightRef.current = false;
    },
    [attemptId]
  );

  // Autosave is best-effort and attempt-scoped. It can never extend the
  // deadline; the backend rejects writes after it.
  useEffect(() => {
    if (!isAttemptMode || !attemptId || hasSubmittedRef.current || isQuizMode || isSubmitting) return;

    if (Object.keys(userAnswers).length === 0) return;

    const serialized = JSON.stringify(userAnswers);
    if (serialized === lastSavedDraftRef.current) return;

    const timer = window.setTimeout(() => {
      void persistDraft({ answers: userAnswers, index: quizIndex, serialized });
    }, 800);

    return () => window.clearTimeout(timer);
  }, [userAnswers, isAttemptMode, attemptId, isQuizMode, quizIndex, persistDraft, isSubmitting]);

  const submitExamMutation = useMutation({
    mutationFn: async (payload: ReturnType<typeof buildSubmitPayload>) => {
      const res = await postExamSubmission<SubmitExamResponse>(payload);

      // Validate the response before leaving the exam page. Without a persisted
      // result id there is nothing to navigate to, and a retry is safe because
      // the request carries the same submission id.
      const resultId = extractSubmittedResultId(res.data);
      const result = res.data?.data ?? res.data;

      return { resultId, result };
    },
    onSuccess: ({ resultId, result }) => {
      clearSubmissionId(submissionStorageKey);
      queryClient.invalidateQueries({ queryKey: ['history'] });
      queryClient.invalidateQueries({ queryKey: ['practice'] });
      queryClient.invalidateQueries({ queryKey: ['progressDashboard'] });

      // Navigate only after the backend confirmed persistence.
      if (resultId && attemptId) {
        void offline.markSubmitted(attemptId, resultId);
      }
      navigate(`/exam/analysis/${resultId}`, {
        state: result,
        replace: true,
      });
    },
    onError: (error) => {
      toast.error(
        resolveSubmitErrorMessage(error, {
          generic: t('exam.submitFailed'),
          network: t('exam.submitNetworkFailed'),
        })
      );

      // Keep the student on the page with their answers intact so the
      // submission can be retried.
      hasSubmittedRef.current = false;
      setIsSubmitting(false);
    },
  });

  const { mutate: submitExam } = submitExamMutation;

  const processSubmission = useCallback(() => {
    if (hasSubmittedRef.current || questions.length === 0) return;

    // Flip both guards synchronously: the ref blocks duplicate submits and the
    // state re-renders the buttons/timer before the network request resolves.
    hasSubmittedRef.current = true;
    setIsSubmitting(true);

    const startedAtMs = attemptStateQuery.data?.started_at
      ? Date.parse(attemptStateQuery.data.started_at)
      : Number.NaN;
    const timeTaken =
      isQuizMode && Number.isFinite(startedAtMs)
        ? Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000))
        : initialDurationSeconds - Math.max(0, timeLeftRef.current);
    const questionIds = questions.map((q) => q.id);

    const payloadForBackend = buildSubmitPayload({
      examId,
      // In attempt mode the server-issued id is the only scope trusted by the
      // backend; `session_id` remains for the legacy untracked path.
      attemptId: isAttemptMode ? attemptId : undefined,
      sessionId: submissionId,
      answers: userAnswers,
      questionIds,
      timeTaken,
    });

    submitExam(payloadForBackend);
  }, [
    questions,
    userAnswers,
    initialDurationSeconds,
    examId,
    isAttemptMode,
    attemptId,
    submissionId,
    submitExam,
    isQuizMode,
    attemptStateQuery.data?.started_at,
  ]);

  useEffect(() => {
    if (isQuizMode) return;
    if (timeLeft <= 0 && questions.length > 0 && !hasSubmittedRef.current) {
      setIsConfirmModalOpen(false);
      processSubmission();
    }
  }, [timeLeft, questions.length, processSubmission, isQuizMode]);

  const quizAnswerMutation = useMutation({
    mutationFn: ({
      questionId,
      optionId,
    }: {
      questionId: string;
      optionId: string;
    }) => practiceService.answerPracticeQuestion(attemptId ?? '', questionId, optionId),
    onSuccess: (reveal, variables) => {
      setQuizReveals((prev) => ({
        ...prev,
        [variables.questionId]: reveal,
      }));
    },
    onError: (error, variables) => {
      setUserAnswers((prev) => {
        if (prev[variables.questionId] !== variables.optionId) return prev;
        const next = { ...prev };
        delete next[variables.questionId];
        return next;
      });
      toast.error(resolvePracticeError(error, t('practice.quiz.answerFailed')));
    },
  });

  const {
    mutate: answerQuizQuestion,
    isPending: isQuizAnswerPending,
  } = quizAnswerMutation;
  const isQuizChecking = isQuizMode && isQuizAnswerPending;

  const handleOptionSelect = useCallback((questionId: string, optionId: string) => {
    if (hasSubmittedRef.current) return;

    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: String(optionId),
    }));

    if (isQuizMode && !quizReveals[questionId] && !isQuizAnswerPending) {
      answerQuizQuestion({ questionId, optionId: String(optionId) });
    }
  }, [isQuizMode, quizReveals, isQuizAnswerPending, answerQuizQuestion]);

  const saveQuizPosition = useCallback(
    (nextIndex: number) => {
      if (!attemptId) return;

      // Position-only save: answers are already persisted by the answer
      // endpoint, so this request must never overwrite a newer draft.
      void practiceService
        .saveDraftAnswers(attemptId, undefined, nextIndex)
        .catch((error) => {
          toast.error(resolvePracticeError(error, t('practice.quiz.saveFailed')));
        });
    },
    [attemptId, t]
  );

  const handleQuizAdvance = useCallback(() => {
    if (quizIndex >= questions.length - 1) {
      setIsConfirmModalOpen(true);
      return;
    }

    const nextIndex = quizIndex + 1;
    setQuizIndex(nextIndex);
    saveQuizPosition(nextIndex);
  }, [quizIndex, questions.length, saveQuizPosition]);

  const handleQuizSkip = useCallback(() => {
    if (quizIndex >= questions.length - 1) {
      setIsConfirmModalOpen(true);
      return;
    }

    const nextIndex = quizIndex + 1;
    setQuizIndex(nextIndex);
    saveQuizPosition(nextIndex);
  }, [quizIndex, questions.length, saveQuizPosition]);

  const handleReportClick = useCallback((questionId: string) => {
    setReportingQuestionId(questionId);
    setIsReportModalOpen(true);
  }, []);

  const reportMutation = useMutation({
    mutationFn: async (reportData: ModalReportPayload) => {
      await apiClient.post('/reports', reportData);
    },
    onSuccess: () => {
      toast.success(t('exam.reportSubmitted'));
    },
    onError: () => {
      toast.error(t('exam.reportSubmitError'));
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-app px-4 py-8 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-16 w-full rounded-2xl bg-surface" />
        <Skeleton className="h-96 w-full rounded-2xl bg-surface" />
        <Skeleton className="h-96 w-full rounded-2xl bg-surface" />
      </div>
    );
  }

  if (isError || questions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-app">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-surface border border-border-color">
          <AlertCircle size={40} className="text-text-primary" />
        </div>

        <h2 className="text-2xl font-bold mb-3 text-text-primary">{t('exam.noQuestionsTitle')}</h2>

        <p className="mb-8 opacity-70 text-text-secondary">
          {t('exam.noQuestionsBody')}
        </p>

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="px-6 py-3 rounded-xl font-medium transition-all active:scale-95 bg-primary text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          {t('common.back')}
        </button>
      </div>
    );
  }

  const answeredCount = Object.keys(userAnswers).length;
  const progressPercentage = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;
  const submissionInProgress = isSubmitting || submitExamMutation.isPending;
  const headerTitle =
    isAttemptMode && practiceMode
      ? t(PRACTICE_TITLES[practiceMode])
      : isAttemptMode
        ? t('practice.attemptFallbackTitle')
        : t('exam.modelTestLive');

  if (isQuizMode && quizQuestion) {
    const quizAnsweredCount = questions.reduce(
      (count, question) => count + (userAnswers[question.id] ? 1 : 0),
      0
    );
    const quizProgress = (quizAnsweredCount / questions.length) * 100;
    const quizCorrectOption = quizQuestion.options.find(
      (option) => option.id === quizReveal?.correct_option?.id
    );
    const quizCorrectLabel = quizCorrectOption
      ? pickLang(language, quizCorrectOption.text_bn, quizCorrectOption.text_en) ||
        quizCorrectOption.text ||
        quizCorrectOption.id
      : quizReveal?.correct_option
        ? pickLang(
            language,
            quizReveal.correct_option.text_bn,
            quizReveal.correct_option.text_en
          ) || quizReveal.correct_option.id
        : '';
    const quizExplanation = getLocalized(quizReveal?.explanation, language);
    const isLastQuestion = quizIndex >= questions.length - 1;
    const quizActionLabel = isLastQuestion
      ? t('practice.quiz.submit')
      : quizReveal
        ? t('practice.quiz.next')
        : t('practice.quiz.skip');

    return (
      <div className="min-h-screen pb-32 lg:pb-10 bg-app text-text-primary">
        <ExamHeader
          title={headerTitle}
          onBack={() => navigate(-1)}
          rightContent={
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-primary">
                {quizIndex + 1}
                <span className="opacity-60 font-normal text-text-secondary">
                  {' / '}
                  {questions.length}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(true)}
                disabled={quizAnsweredCount === 0 || submissionInProgress || isQuizChecking}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-40"
              >
                {t('practice.quiz.submit')}
              </button>
            </div>
          }
        />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <div className="lg:grid lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-8 space-y-5">
              <LiveQuestionCard
                question={quizQuestion}
                index={quizIndex}
                selectedOptionId={userAnswers[quizQuestion.id]}
                onSelectOption={handleOptionSelect}
                onReport={handleReportClick}
                revealed={Boolean(quizReveal)}
                correctOptionId={quizReveal?.correct_option?.id ?? null}
              />

              {quizReveal && (
                <div
                  className={`rounded-2xl border p-5 md:p-6 ${
                    quizReveal.is_correct
                      ? 'border-emerald-500/40 bg-emerald-500/5'
                      : 'border-red-500/40 bg-red-500/5'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold mb-3">
                    {quizReveal.is_correct ? (
                      <CheckCircle size={20} className="text-emerald-600" />
                    ) : (
                      <XCircle size={20} className="text-red-600" />
                    )}
                    <span
                      className={
                        quizReveal.is_correct ? 'text-emerald-700' : 'text-red-700'
                      }
                    >
                      {quizReveal.is_correct
                        ? t('practice.quiz.correct')
                        : t('practice.quiz.wrong')}
                    </span>
                  </div>

                  {quizCorrectLabel && (
                    <p className="text-sm md:text-[15px] text-text-primary mb-3">
                      <span className="font-semibold">
                        {t('practice.quiz.correctAnswer')}:{' '}
                      </span>
                      <MathDisplay content={quizCorrectLabel} />
                    </p>
                  )}

                  {quizExplanation ? (
                    <div className="rounded-xl bg-surface border border-border-color p-4 text-sm md:text-[15px] leading-relaxed text-text-secondary">
                      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-text-primary opacity-70">
                        {t('practice.quiz.explanation')}
                      </p>
                      <MathDisplay content={quizExplanation} />
                    </div>
                  ) : (
                    <p className="text-sm text-text-secondary opacity-70">
                      {t('practice.quiz.noExplanation')}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="hidden lg:block lg:col-span-4">
              <div className="sticky top-24 space-y-5">
                <div className="p-6 rounded-2xl border shadow-sm bg-card-bg border-card-border">
                  <h3 className="font-bold text-lg mb-4 text-text-primary">
                    {t('practice.quiz.progressTitle')}
                  </h3>
                  <div className="flex justify-between text-sm mb-2 text-text-primary opacity-80">
                    <span>{t('practice.quiz.answered')}</span>
                    <span className="font-bold">
                      {quizAnsweredCount} / {questions.length}
                    </span>
                  </div>
                  <div className="w-full h-3 rounded-full overflow-hidden bg-surface border border-border-color">
                    <div
                      className="h-full transition-all duration-500 rounded-full bg-primary"
                      style={{ width: `${quizProgress}%` }}
                    />
                  </div>
                  <p className="mt-4 text-xs leading-relaxed text-text-secondary opacity-70">
                    {t('practice.quiz.helper')}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={quizReveal ? handleQuizAdvance : handleQuizSkip}
                  disabled={submissionInProgress || isQuizChecking}
                  className="w-full flex items-center justify-center gap-2 font-bold py-4 rounded-xl disabled:opacity-50 transition-all shadow-md hover:shadow-lg active:scale-95 bg-primary text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  {quizReveal ? <ChevronRight size={20} /> : <SkipForward size={20} />}
                  {isQuizChecking ? t('practice.quiz.checking') : quizActionLabel}
                </button>

                {quizReveal && !isLastQuestion && (
                  <button
                    type="button"
                    onClick={handleQuizSkip}
                    disabled={submissionInProgress}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-border-color py-3 text-sm font-semibold text-text-secondary disabled:opacity-50"
                  >
                    <SkipForward size={16} />
                    {t('practice.quiz.skip')}
                  </button>
                )}

                {quizAllAnswered && !isLastQuestion && (
                  <button
                    type="button"
                    onClick={() => setIsConfirmModalOpen(true)}
                    disabled={submissionInProgress || isQuizChecking}
                    className="w-full rounded-xl border border-border-color py-3 text-sm font-semibold text-text-secondary disabled:opacity-50"
                  >
                    {t('practice.quiz.submit')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:hidden fixed bottom-0 left-0 w-full p-4 z-40 backdrop-blur-xl border-t bg-surface-elevated border-border-color">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-full h-1.5 rounded-full overflow-hidden bg-surface border border-border-color">
              <div
                className="h-full transition-all duration-500 bg-primary"
                style={{ width: `${quizProgress}%` }}
              />
            </div>
            <span className="text-xs font-bold whitespace-nowrap text-text-primary">
              {quizIndex + 1} / {questions.length}
            </span>
          </div>
          <button
            type="button"
            onClick={quizReveal ? handleQuizAdvance : handleQuizSkip}
            disabled={submissionInProgress || isQuizChecking}
            className="w-full flex items-center justify-center gap-2 font-bold py-3.5 rounded-xl disabled:opacity-50 transition-all active:scale-95 bg-primary text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {quizReveal ? <ChevronRight size={18} /> : <SkipForward size={18} />}
            {isQuizChecking ? t('practice.quiz.checking') : quizActionLabel}
          </button>
        </div>

        {isReportModalOpen && reportingQuestionId && reportQuestionData && (
          <ReportModal
            isOpen={isReportModalOpen}
            onClose={() => setIsReportModalOpen(false)}
            type="question_issue"
            questionData={reportQuestionData}
            onSubmit={async (data) => {
              await reportMutation.mutateAsync(data);
              setIsReportModalOpen(false);
            }}
          />
        )}

        {isConfirmModalOpen && (
          <ConfirmModal
            isOpen={isConfirmModalOpen}
            title={t('exam.submitConfirmTitle')}
            message={t('exam.submitConfirmMessage', { count: quizAnsweredCount })}
            onConfirm={() => {
              setIsConfirmModalOpen(false);
              processSubmission();
            }}
            onCancel={() => setIsConfirmModalOpen(false)}
            isLoading={submitExamMutation.isPending}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32 lg:pb-10 bg-app text-text-primary">
      <ExamHeader
        title={headerTitle}
        onBack={() => navigate(-1)}
        rightContent={
          <div className="flex items-center gap-4">
            <div className="font-bold text-lg hidden sm:block text-primary">
              {answeredCount}{' '}
              <span className="opacity-60 text-sm font-normal text-text-secondary">
                / {questions.length}
              </span>
            </div>
            <ExamTimer seconds={timeLeft} layout="compact" />
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8 xl:gap-12">
          <div className="lg:col-span-8 space-y-6 lg:space-y-8">
            <ExamQuestionList
              questions={questions}
              userAnswers={userAnswers}
              onSelectOption={handleOptionSelect}
              onReport={handleReportClick}
            />
          </div>

          <div className="hidden lg:block lg:col-span-4">
            <div className="sticky top-24 space-y-6">
              <ExamTimer seconds={timeLeft} layout="card" />

              <div className="p-6 rounded-2xl border shadow-sm bg-card-bg border-card-border">
                <h3 className="font-bold text-lg mb-4 font-['Noto_Sans_Bengali'] text-text-primary">
              {t('exam.progress')}
                </h3>

                <div className="flex justify-between text-sm mb-2 opacity-80 text-text-primary">
              <span>{t('exam.answered')}</span>
                  <span className="font-bold">
                    {answeredCount} / {questions.length}
                  </span>
                </div>

                <div className="w-full h-3 rounded-full overflow-hidden bg-surface border border-border-color">
                  <div
                    className="h-full transition-all duration-500 rounded-full bg-primary"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(true)}
                disabled={submissionInProgress}
                className="w-full flex items-center justify-center gap-3 font-bold py-4 rounded-xl disabled:opacity-50 transition-all shadow-md hover:shadow-lg active:scale-95 text-lg hover:opacity-90 bg-primary text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <CheckCircle size={22} />
                {submissionInProgress ? t('exam.submittingAnswerSheet') : t('exam.submitAnswerSheet')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:hidden fixed bottom-0 left-0 w-full p-4 z-40 backdrop-blur-xl border-t bg-surface-elevated border-border-color">
        <div className="flex items-center gap-4 mb-3 sm:hidden">
          <div className="w-full h-1.5 rounded-full overflow-hidden bg-surface border border-border-color">
            <div
              className="h-full transition-all duration-500 bg-primary"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          <span className="text-xs font-bold whitespace-nowrap text-text-primary">
            {answeredCount} / {questions.length}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsConfirmModalOpen(true)}
          disabled={submissionInProgress}
          className="w-full font-bold py-3.5 rounded-xl disabled:opacity-50 transition-all active:scale-95 shadow-sm text-base hover:opacity-90 bg-primary text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          {submissionInProgress ? t('exam.submittingAnswerSheet') : t('exam.submitAnswerSheet')}
        </button>
      </div>

      {isReportModalOpen && reportingQuestionId && reportQuestionData && (
        <ReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          type="question_issue"
          questionData={reportQuestionData}
          onSubmit={async (data) => {
            await reportMutation.mutateAsync(data);
            setIsReportModalOpen(false);
          }}
        />
      )}

      {isConfirmModalOpen && (
        <ConfirmModal
          isOpen={isConfirmModalOpen}
        title={t('exam.submitConfirmTitle')}
          message={t('exam.submitConfirmMessage', { count: answeredCount })}
          onConfirm={() => {
            setIsConfirmModalOpen(false);
            processSubmission();
          }}
          onCancel={() => setIsConfirmModalOpen(false)}
          isLoading={submitExamMutation.isPending}
        />
      )}
    </div>
  );
};

export default memo(Arena);
