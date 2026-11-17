import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { beginExamActivity } from '@/features/app-update/examActivity';
import { localizeDigits } from '@/shared/i18n/messages';
import QuestionCard from '@/features/exam/components/QuestionCard';
import ExamTimer from '@/features/exam/components/ExamTimer';
import ExamHeader from '@/features/exam/components/ExamHeader';
import ConfirmModal from '@/shared/components/feedback/ConfirmModal';
import {
  buildSubmissionStorageKey,
  buildSubmitPayload,
  clearSubmissionId,
  getOrCreateSubmissionId,
  resolveSubmitErrorMessage,
} from '@/features/exam/utils/examSubmission';
import { useAdmissionExamPaper } from '../hooks/useAdmissionCatalog';
import { useAdmissionExamSession } from '../hooks/useAdmissionExamSession';
import { useOfflineExam } from '@/features/exam/offline/useOfflineExam';
import { AdmissionExamSkeleton } from '../components/AdmissionSkeleton';
import { AdmissionQuestionNavigator } from '../components/AdmissionQuestionNavigator';
import { AdmissionState } from '../components/AdmissionState';

type SessionErrorShape = {
  response?: {
    status?: number;
    data?: {
      code?: string;
      message?: string;
      details?: { exam_history_id?: string | null } | null;
    };
  };
};

type SessionErrorInfo = {
  kind: 'already_attempted' | 'free_limit' | 'not_started' | 'window_closed' | 'generic';
  historyId: string | null;
  message: string | null;
};

/**
 * Classifies a failed attempt start so the page can show the right state
 * instead of a single generic "exam unavailable" message.
 */
const getSessionErrorInfo = (error: unknown): SessionErrorInfo => {
  const shape = (error ?? {}) as SessionErrorShape;
  const status = shape.response?.status;
  const code = shape.response?.data?.code;
  const rawMessage = shape.response?.data?.message;
  const historyId = shape.response?.data?.details?.exam_history_id ?? null;

  if (status === 409 && code === 'ALREADY_ATTEMPTED') {
    return { kind: 'already_attempted', historyId, message: rawMessage ?? null };
  }

  if (status === 403 && code === 'FREE_LIMIT_REACHED') {
    return { kind: 'free_limit', historyId: null, message: rawMessage ?? null };
  }

  if (status === 403 && typeof rawMessage === 'string') {
    if (/not started/i.test(rawMessage)) {
      return { kind: 'not_started', historyId: null, message: rawMessage };
    }

    if (/window is closed|window closed/i.test(rawMessage)) {
      return { kind: 'window_closed', historyId: null, message: rawMessage };
    }
  }

  return { kind: 'generic', historyId: null, message: rawMessage ?? null };
};

const AdmissionExamPage: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const { t, language } = useLanguage();

  const paperQuery = useAdmissionExamPaper(examId);
  const session = useAdmissionExamSession(examId);
  const offline = useOfflineExam();
  const { attempt, questions, submit, saveDraft, isSubmitting, isOfflineMode } =
    session;

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [initializedAttemptId, setInitializedAttemptId] = useState<string | null>(
    null
  );
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [autosaveInvalidated, setAutosaveInvalidated] = useState<{
    historyId: string | null;
  } | null>(null);
  const [submissionQueued, setSubmissionQueued] = useState(false);

  const submittedRef = useRef(false);
  const timeLeftRef = useRef(0);

  // Admission attempts block OTA activation until the submission is confirmed.
  useEffect(() => {
    if (!attempt || questions.length === 0) return undefined;
    return beginExamActivity(
      `admission:${attempt.id}`,
      isSubmitting ? 'submission_pending' : 'exam_active'
    );
  }, [attempt, isSubmitting, questions.length]);
  const endTimeRef = useRef<number | null>(null);
  const initialSecondsRef = useRef(0);
  const lastSavedRef = useRef('');
  const serverDeadlineRef = useRef<number | null>(null);
  const autosaveStoppedRef = useRef(false);

  const submissionStorageKey = useMemo(
    () => buildSubmissionStorageKey(`admission-${examId ?? 'unknown'}`),
    [examId]
  );
  const [submissionId] = useState(() =>
    getOrCreateSubmissionId(submissionStorageKey)
  );

  const paper = paperQuery.data ?? null;

  // Restore server-held draft answers when the attempt is (re)loaded.
  useEffect(() => {
    if (!attempt || initializedAttemptId === attempt.id) return;

    setAnswers(attempt.answers_draft ?? {});
    const maxIndex = Math.max(0, (attempt.question_ids?.length ?? 1) - 1);
    setCurrentIndex(
      Math.min(Math.max(0, attempt.current_question_index), maxIndex)
    );
    setInitializedAttemptId(attempt.id);
  }, [attempt, initializedAttemptId]);

  useEffect(() => {
    if (attempt) {
      const declaredTotal = paper?.duration_min
        ? paper.duration_min * 60
        : attempt.seconds_remaining ?? 0;
      initialSecondsRef.current = Math.max(
        declaredTotal,
        attempt.seconds_remaining ?? 0
      );
    }
  }, [attempt, paper?.duration_min]);

  // The timer is driven by the server-issued remaining seconds/deadline, so a
  // refresh cannot extend an admission attempt.
  useEffect(() => {
    if (!attempt) return;

    // One server/client clock-offset correction, taken from the server's own
    // `server_time` in the attempt response. The absolute deadline is then
    // anchored in local wall-clock time, so a wrong device clock (or a refresh)
    // cannot restart or extend the countdown.
    const serverTimeRaw = (attempt as { server_time?: string }).server_time;
    const serverTime = typeof serverTimeRaw === 'string' ? Date.parse(serverTimeRaw) : NaN;
    const clientNow = Date.now();
    const clockOffsetMs = Number.isFinite(serverTime) ? serverTime - clientNow : 0;

    const parsedDeadline = attempt.deadline_at ? Date.parse(attempt.deadline_at) : NaN;
    const fallbackSeconds =
      typeof attempt.seconds_remaining === 'number' ? attempt.seconds_remaining : 0;

    const deadlineMs = Number.isFinite(parsedDeadline)
      ? parsedDeadline - clockOffsetMs
      : clientNow + Math.max(0, fallbackSeconds) * 1000;

    serverDeadlineRef.current = deadlineMs;
    endTimeRef.current = deadlineMs;

    const remainingAtStart = Math.max(
      0,
      Math.ceil((deadlineMs - Date.now()) / 1000)
    );

    setTimeLeft(remainingAtStart);
    timeLeftRef.current = remainingAtStart;

    if (remainingAtStart > 0) {
      initialSecondsRef.current = Math.max(
        initialSecondsRef.current,
        remainingAtStart
      );
    }

    const interval = window.setInterval(() => {
      const deadline = serverDeadlineRef.current ?? Date.now();
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTimeLeft(remaining);
      timeLeftRef.current = remaining;

      if (remaining <= 0) window.clearInterval(interval);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [attempt]);

  useEffect(() => {
    if (questions.length === 0) return;
    setCurrentIndex((previous) => Math.min(previous, questions.length - 1));
  }, [questions.length]);

  // Persist answers as a server-side draft so a refresh resumes the attempt.
  // Offline, durable answers are already written locally by handleSelectOption;
  // server autosave is skipped to avoid a network toast storm.
  useEffect(() => {
    if (!attempt || initializedAttemptId !== attempt.id) return;
    if (questions.length === 0) return;
    if (isOfflineMode) return;

    const snapshot = JSON.stringify({ answers, currentIndex });
    if (snapshot === lastSavedRef.current) return;

    if (autosaveStoppedRef.current) return;

    const timeout = window.setTimeout(() => {
      lastSavedRef.current = snapshot;

      saveDraft(
        { answers, currentIndex },
        {
          onError: (error: unknown) => {
            const shape = (error ?? {}) as SessionErrorShape;
            const status = shape.response?.status;

            // Once the attempt is no longer in progress, further autosaves are
            // pointless and could overwrite a submitted draft. Stop, tell the
            // student and keep the local answers for a result link.
            if (status === 409) {
              autosaveStoppedRef.current = true;
              setAutosaveInvalidated({
                historyId: shape.response?.data?.details?.exam_history_id ?? null,
              });
              toast.error(t('admission.exam.noLongerActive'));
              return;
            }

            toast.error(t('admission.exam.draftSaveFailed'));
          },
        }
      );
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [
    answers,
    currentIndex,
    attempt,
    initializedAttemptId,
    questions.length,
    saveDraft,
    isOfflineMode,
  ]);

  const processSubmission = useCallback(() => {
    if (submittedRef.current || !attempt || questions.length === 0) return;

    submittedRef.current = true;
    const timeTaken = Math.max(
      0,
      initialSecondsRef.current - timeLeftRef.current
    );

    const payload = buildSubmitPayload({
      examId,
      attemptId: attempt.id,
      sessionId: submissionId,
      answers,
      questionIds: questions.map((question) => question.id),
      timeTaken,
    });

    submit(payload, {
      onSuccess: ({ resultId, result }) => {
        clearSubmissionId(submissionStorageKey);

        // Offline submission is queued; there is no result id to navigate to.
        if (!resultId) {
          setSubmissionQueued(true);
          toast.success(t('admission.exam.submissionQueued'));
          return;
        }

        void offline.markSubmitted(attempt.id, resultId);

        navigate(`/exam/analysis/${resultId}`, {
          state: result,
          replace: true,
        });
      },
      onError: (error) => {
        // A network failure while online is queued durably so the work is not
        // lost; the sync runs automatically when connectivity returns.
        if (offline.isOnline && !(error as { response?: unknown })?.response) {
          void offline
            .queueSubmission(attempt?.id ?? '', answers, questions.map((q) => q.id))
            .then(() => {
              setSubmissionQueued(true);
              toast.success(t('admission.exam.submissionQueued'));
            })
            .catch(() => {
              submittedRef.current = false;
              toast.error(
                resolveSubmitErrorMessage(error, {
                  generic: t('exam.submitFailed'),
                  network: t('exam.submitNetworkFailed'),
                })
              );
            });
          return;
        }

        submittedRef.current = false;
        toast.error(
          resolveSubmitErrorMessage(error, {
            generic: t('exam.submitFailed'),
            network: t('exam.submitNetworkFailed'),
          })
        );
      },
    });
  }, [
    answers,
    attempt,
    examId,
    navigate,
    questions,
    submissionId,
    submissionStorageKey,
    submit,
    t,
    offline.isOnline,
    offline.markSubmitted,
    offline.queueSubmission,
  ]);

  useEffect(() => {
    if (
      timeLeft === 0 &&
      attempt &&
      questions.length > 0 &&
      initializedAttemptId === attempt.id &&
      !submittedRef.current
    ) {
      setIsConfirmOpen(false);
      processSubmission();
    }
  }, [
    attempt,
    initializedAttemptId,
    processSubmission,
    questions.length,
    timeLeft,
  ]);

  const handleSelectOption = useCallback(
    (questionId: string, optionId: string) => {
      if (submittedRef.current) return;
      setAnswers((previous) => ({
        ...previous,
        [questionId]: String(optionId),
      }));

      // Durable local persistence so a reload/restart never loses the answer,
      // even while offline. Failures surface only through the retry path.
      if (attempt?.id && (!offline.isOnline || isOfflineMode)) {
        void offline
          .saveAnswer(attempt.id, questionId, String(optionId))
          .catch(() => {});
      }
    },
    [attempt?.id, offline.isOnline, offline.saveAnswer, isOfflineMode]
  );

  if (!examId) {
    return (
      <div className="mx-auto min-h-screen w-full max-w-4xl bg-app px-4 py-10">
        <AdmissionState
          variant="not-found"
          title={t('admission.notFoundTitle')}
          message={t('admission.examNotFound')}
          actionLabel={t('admission.backToAdmission')}
          onAction={() => navigate('/admission')}
        />
      </div>
    );
  }

  if (paperQuery.isLoading || session.isLoading) {
    return <AdmissionExamSkeleton />;
  }

  if (session.error) {
    const info = getSessionErrorInfo(session.error);

    if (info.kind === 'already_attempted') {
      const resultPath = info.historyId ? `/exam/analysis/${info.historyId}` : null;

      return (
        <div className="mx-auto min-h-screen w-full max-w-4xl bg-app px-4 py-10">
          <AdmissionState
            variant="error"
            title={t('admission.exam.alreadyTakenTitle')}
            message={t('admission.exam.alreadyTakenBody')}
            actionLabel={resultPath ? t('admission.exam.viewResult') : t('admission.backToAdmission')}
            onAction={() => navigate(resultPath ?? '/admission')}
            secondaryLabel={t('admission.back')}
            onSecondary={() => navigate(-1)}
          />
        </div>
      );
    }

    if (info.kind === 'free_limit') {
      // apiClient also dispatches `access:error`, which opens the paywall. This
      // state explains the limit instead of claiming the exam is unavailable.
      return (
        <div className="mx-auto min-h-screen w-full max-w-4xl bg-app px-4 py-10">
          <AdmissionState
            variant="error"
            title={t('admission.exam.freeLimitTitle')}
            message={t('admission.exam.freeLimitBody')}
            actionLabel={t('admission.exam.viewPremiumPlan')}
            onAction={() => navigate('/premium')}
            secondaryLabel={t('admission.backToAdmission')}
            onSecondary={() => navigate('/admission')}
          />
        </div>
      );
    }

    if (info.kind === 'not_started' || info.kind === 'window_closed') {
      return (
        <div className="mx-auto min-h-screen w-full max-w-4xl bg-app px-4 py-10">
          <AdmissionState
            variant="not-found"
            title={
              info.kind === 'not_started'
                ? t('admission.exam.notStartedYet')
                : t('admission.exam.timeOver')
            }
            message={
              info.kind === 'not_started'
                ? t('admission.exam.tryAtScheduledTime')
                : t('admission.exam.timeLimitPassed')
            }
            actionLabel={t('admission.backToAdmission')}
            onAction={() => navigate('/admission')}
          />
        </div>
      );
    }

    return (
      <div className="mx-auto min-h-screen w-full max-w-4xl bg-app px-4 py-10">
        <AdmissionState
          variant="error"
          title={t('admission.examUnavailableTitle')}
          message={info.message || t('admission.examUnavailableMessage')}
          actionLabel={t('admission.backToAdmission')}
          onAction={() => navigate('/admission')}
          secondaryLabel={t('admission.back')}
          onSecondary={() => navigate(-1)}
        />
      </div>
    );
  }

  if (paperQuery.isError) {
    return (
      <div className="mx-auto min-h-screen w-full max-w-4xl bg-app px-4 py-10">
        <AdmissionState
          variant="error"
          title={t('admission.errorTitle')}
          message={t('admission.errorMessage')}
          actionLabel={t('admission.retry')}
          onAction={() => paperQuery.refetch()}
        />
      </div>
    );
  }

  if (!paper || paper.is_published === false) {
    return (
      <div className="mx-auto min-h-screen w-full max-w-4xl bg-app px-4 py-10">
        <AdmissionState
          variant="not-found"
          title={t('admission.notFoundTitle')}
          message={t('admission.examNotFound')}
          actionLabel={t('admission.backToAdmission')}
          onAction={() => navigate('/admission')}
        />
      </div>
    );
  }

  if (!attempt || questions.length === 0) {
    return (
      <div className="mx-auto min-h-screen w-full max-w-4xl bg-app px-4 py-10">
        <AdmissionState
          variant="empty"
          title={t('admission.noQuestions')}
          message={t('admission.noQuestionsHint')}
          actionLabel={t('admission.backToAdmission')}
          onAction={() => navigate('/admission')}
        />
      </div>
    );
  }

  const currentQuestion = questions[currentIndex] ?? questions[0];
  const answeredCount = questions.filter((question) =>
    Boolean(answers[question.id])
  ).length;
  const total = questions.length;
  const currentNumber = localizeDigits(currentIndex + 1, language);
  const totalNumber = localizeDigits(total, language);
  const answeredNumber = localizeDigits(answeredCount, language);
  const secondsLeft = timeLeft ?? attempt.seconds_remaining ?? 0;

  const goPrevious = () =>
    setCurrentIndex((previous) => Math.max(0, previous - 1));
  const goNext = () =>
    setCurrentIndex((previous) => Math.min(total - 1, previous + 1));

  return (
    <div className="min-h-screen bg-app pb-32 text-text-primary lg:pb-8">
      <ExamHeader
        title={paper.title || t('admission.examHeader')}
        onBack={() => navigate(-1)}
        rightContent={<ExamTimer seconds={secondsLeft} layout="compact" />}
      />

      <main className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-5 sm:py-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-card-border bg-card-bg px-4 py-2.5 text-xs font-semibold text-text-secondary sm:text-sm">
          <span className="font-['Noto_Sans_Bengali']">
            {t('admission.questionOf', {
              current: currentNumber,
              total: totalNumber,
            })}
          </span>
          <span className="font-['Noto_Sans_Bengali']">
            {t('admission.answered')}: {answeredNumber} / {totalNumber}
          </span>
        </div>

        {autosaveInvalidated && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/40 bg-surface px-4 py-3 text-xs font-semibold text-accent sm:text-sm">
            <span>{t('admission.exam.noSavingBanner')}</span>
            {autosaveInvalidated.historyId && (
              <button
                type="button"
                onClick={() =>
                  navigate(`/exam/analysis/${autosaveInvalidated.historyId}`, { replace: true })
                }
                className="rounded-lg bg-primary px-3 py-1.5 font-bold text-primary-foreground"
              >
                {t('admission.exam.viewResult')}
              </button>
            )}
          </div>
        )}

        {submissionQueued && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/5 px-4 py-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300 sm:text-sm">
            <CheckCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t('admission.exam.submissionQueued')}</span>
          </div>
        )}

        {isOfflineMode && !submissionQueued && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-xs font-semibold text-amber-700 dark:text-amber-300 sm:text-sm">
            <span>{t('admission.exam.offlineMode')}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            <QuestionCard
              question={currentQuestion}
              selectedOptionId={answers[currentQuestion.id]}
              onOptionSelect={(optionId) =>
                handleSelectOption(currentQuestion.id, optionId)
              }
              imageAlt={t('admission.questionImageAlt')}
            />

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={goPrevious}
                disabled={currentIndex === 0}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border-color bg-surface px-4 py-3 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                {t('admission.previous')}
              </button>

              <button
                type="button"
                onClick={goNext}
                disabled={currentIndex >= total - 1}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border-color bg-surface px-4 py-3 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                {t('admission.next')}
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 lg:hidden">
              <AdmissionQuestionNavigator
                questionIds={questions.map((question) => question.id)}
                currentIndex={currentIndex}
                answers={answers}
                onSelect={setCurrentIndex}
              />
            </div>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-20 space-y-4">
              <ExamTimer
                seconds={secondsLeft}
                layout="card"
                label={t('admission.timeLeft')}
              />

              <AdmissionQuestionNavigator
                questionIds={questions.map((question) => question.id)}
                currentIndex={currentIndex}
                answers={answers}
                onSelect={setCurrentIndex}
              />

              <button
                type="button"
                onClick={() => setIsConfirmOpen(true)}
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <CheckCircle className="h-5 w-5" aria-hidden="true" />
                {isSubmitting ? t('admission.submitting') : t('admission.submit')}
              </button>
            </div>
          </aside>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border-color bg-surface-elevated p-3 backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-3 gap-2">
          <button
            type="button"
            onClick={goPrevious}
            disabled={currentIndex === 0}
            aria-label={t('admission.previous')}
            className="flex items-center justify-center rounded-xl border border-border-color bg-surface py-3 text-text-primary disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => setIsConfirmOpen(true)}
            disabled={isSubmitting}
            className="col-span-1 rounded-xl bg-primary px-2 py-3 text-xs font-bold text-primary-foreground disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring sm:text-sm"
          >
            {isSubmitting ? t('admission.submitting') : t('admission.submit')}
          </button>

          <button
            type="button"
            onClick={goNext}
            disabled={currentIndex >= total - 1}
            aria-label={t('admission.next')}
            className="flex items-center justify-center rounded-xl border border-border-color bg-surface py-3 text-text-primary disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={isConfirmOpen}
        title={t('admission.submitTitle')}
        message={t('admission.submitMessage', { answered: answeredNumber })}
        confirmText={t('admission.submitConfirm')}
        cancelText={t('admission.submitCancel')}
        loadingText={t('admission.submitting')}
        isLoading={isSubmitting}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={() => {
          setIsConfirmOpen(false);
          processSubmission();
        }}
      />
    </div>
  );
};

export default AdmissionExamPage;
