import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  extractSubmittedResultId,
  type SubmitPayload,
} from '@/features/exam/utils/examSubmission';
import { postExamSubmission } from '@/features/exam/utils/examSubmissionRequest';
import type { Question } from '@/features/exam/types/exam';
import { useOfflineExam } from '@/features/exam/offline/useOfflineExam';
import { computeRemainingSeconds } from '@/features/exam/offline/offlineExamService';
import { admissionExamService, mapAttemptQuestion } from '../services/admissionExamService';
import type { AdmissionAttempt } from '../types/admission';

/**
 * Admission exam sessions reuse the backend's authoritative attempt lifecycle.
 * The browser never receives the answer key and never computes a trusted score.
 *
 * When the attempt cannot be reached and a prepared offline dataset exists, the
 * session falls back to the locally cached attempt/questions so a prepared exam
 * can be started (or resumed) without connectivity. The server-issued attempt
 * id and deadline are preserved, so a later submission stays authoritative and
 * idempotent.
 */

type OfflineSessionState = {
  attempt: AdmissionAttempt;
  questions: Question[];
};

const isNetworkError = (error: unknown): boolean => {
  const candidate = error as { response?: { status?: number } };
  return !candidate?.response;
};

export const useAdmissionExamSession = (examId: string | undefined) => {
  const offline = useOfflineExam();
  const [offlineSession, setOfflineSession] = useState<OfflineSessionState | null>(null);

  const attemptQuery = useQuery({
    queryKey: ['admission', 'attempt', examId],
    queryFn: () => admissionExamService.startAttempt(examId ?? ''),
    enabled: Boolean(examId),
    retry: 0,
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const onlineAttempt = attemptQuery.data ?? null;

  const questionsQuery = useQuery({
    queryKey: ['admission', 'attempt-questions', onlineAttempt?.id],
    queryFn: () =>
      admissionExamService.getAttemptQuestions(onlineAttempt?.id ?? ''),
    enabled: Boolean(onlineAttempt?.id),
    retry: 1,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const onlineQuestions = useMemo(
    () => (questionsQuery.data?.questions ?? []).map(mapAttemptQuestion),
    [questionsQuery.data]
  );

  // Fall back to the prepared offline dataset only when the online attempt is
  // unreachable (network failure) and the device reports itself offline.
  useEffect(() => {
    if (!examId || !attemptQuery.isError || offline.isOnline) return;
    if (!isNetworkError(attemptQuery.error)) return;
    if (offlineSession) return;

    let cancelled = false;
    void (async () => {
      try {
        const prepared = await offline.loadPreparedExam(examId);
        if (cancelled || !prepared) return;

        const recovered = await offline.recoverAttempt(prepared.attemptId);
        const recoveredAnswers: Record<string, string> = {};
        for (const answer of recovered.answers) {
          recoveredAnswers[answer.questionId] = answer.value;
        }

        const questions = (prepared.questions as unknown as Question[]).map((q) =>
          mapAttemptQuestion(q as Parameters<typeof mapAttemptQuestion>[0])
        );

        const remaining = computeRemainingSeconds(prepared.deadlineAt, Date.now());

        setOfflineSession({
          attempt: {
            id: prepared.attemptId,
            exam_id: prepared.examId,
            kind: prepared.kind,
            status: 'in_progress',
            started_at: prepared.startedAt,
            deadline_at: prepared.deadlineAt,
            submitted_at: null,
            server_time: new Date().toISOString(),
            seconds_remaining: remaining,
            answers_draft: recoveredAnswers,
            current_question_index: 0,
            question_ids: prepared.questionIds,
          },
          questions,
        });
      } catch {
        // No usable offline dataset; the online error state remains authoritative.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    examId,
    attemptQuery.isError,
    attemptQuery.error,
    offline.isOnline,
    offline.loadPreparedExam,
    offline.recoverAttempt,
    offlineSession,
  ]);

  const isOfflineMode = Boolean(offlineSession) && !offline.isOnline;
  const attempt = isOfflineMode ? offlineSession?.attempt ?? null : onlineAttempt;
  const questions = isOfflineMode ? offlineSession?.questions ?? [] : onlineQuestions;

  const saveDraftMutation = useMutation({
    mutationFn: ({
      answers,
      currentIndex,
    }: {
      answers: Record<string, string>;
      currentIndex: number;
    }) => {
      if (!attempt?.id) return Promise.resolve();
      return admissionExamService.saveDraftAnswers(attempt.id, answers, currentIndex);
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (payload: SubmitPayload) => {
      const response = await postExamSubmission(payload);
      const resultId = extractSubmittedResultId(response.data);
      const result = response.data?.data ?? response.data;
      return { resultId, result };
    },
  });

  // Single submit entry point. Offline it queues the submission durably and
  // resolves with an empty id (so callers never navigate to a result page that
  // does not exist yet); online it performs the authoritative server submit.
  const submit = (
    payload: SubmitPayload,
    opts?: {
      onSuccess?: (value: { resultId: string; result: unknown }) => void;
      onError?: (error: unknown) => void;
    }
  ): void => {
    if (isOfflineMode) {
      void (async () => {
        try {
          if (attempt?.id) {
            await offline.queueSubmission(
              attempt.id,
              payload.answers,
              payload.question_ids
            );
          }
          opts?.onSuccess?.({ resultId: '', result: { queued: true } });
        } catch (error) {
          opts?.onError?.(error);
        }
      })();
      return;
    }

    submitMutation.mutate(payload, opts as Parameters<typeof submitMutation.mutate>[1]);
  };

  return {
    attempt,
    questions,
    questionsResponse: questionsQuery.data ?? null,
    isOfflineMode,
    isLoading:
      !isOfflineMode &&
      (attemptQuery.isPending ||
        (Boolean(onlineAttempt?.id) && questionsQuery.isLoading)),
    error: isOfflineMode ? null : attemptQuery.error ?? questionsQuery.error,
    refetch: async () => {
      if (isOfflineMode) return;
      await attemptQuery.refetch();
      if (onlineAttempt?.id) await questionsQuery.refetch();
    },
    saveDraft: saveDraftMutation.mutate,
    isSavingDraft: saveDraftMutation.isPending,
    submit,
    isSubmitting: isOfflineMode ? false : submitMutation.isPending,
  };
};
