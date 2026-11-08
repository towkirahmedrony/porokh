import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { apiClient } from '@/shared/lib/apiClient';
import { admissionExamService } from '@/features/admission/services/admissionExamService';
import { extractSubmittedResultId } from '@/features/exam/utils/examSubmission';
import { postExamSubmission } from '@/features/exam/utils/examSubmissionRequest';
import {
  loadPreparedExamForStart,
  listPreparedExamsForUser,
  markAttemptSubmitted,
  prepareExamForOffline,
  queueOfflineSubmission,
  recoverOfflineAttempt,
  removePreparedExam,
  reconcileFinalizedAttempts,
  saveOfflineAnswer,
  syncPendingSubmissions,
  type OfflineExamApi,
  type SubmitPayload,
} from './offlineExamService';
import type { PreparedExamRecord } from './types';

/**
 * React binding for the offline exam orchestrator, wired to the real backend
 * attempt lifecycle. It exposes prepare/save/queue/sync plus a `navigator`
 * connectivity flag and synchronizes pending submissions on startup and when
 * connectivity returns.
 */

const realApi: OfflineExamApi = {
  startAttempt: async (_userId, examId) => {
    const attempt = await admissionExamService.startAttempt(examId);
    return {
      id: attempt.id,
      exam_id: attempt.exam_id,
      kind: attempt.kind,
      started_at: attempt.started_at,
      deadline_at: attempt.deadline_at,
      seconds_remaining: attempt.seconds_remaining,
      question_ids: attempt.question_ids,
    };
  },
  getAttemptQuestions: async (_userId, attemptId) => {
    const response = await admissionExamService.getAttemptQuestions(attemptId);
    return {
      attempt_id: response.attempt_id,
      exam_id: response.exam_id,
      started_at: response.started_at,
      deadline_at: response.deadline_at,
      server_time: response.server_time,
      questions: response.questions,
    };
  },
};

const realSubmit = async (payload: SubmitPayload) => {
  const response = await postExamSubmission({
    exam_id: payload.examId ?? null,
    attempt_id: payload.attemptId,
    session_id: payload.sessionId,
    answers: payload.answers,
    question_ids: payload.questionIds,
    time_taken: payload.timeTaken,
  });

  const resultId = extractSubmittedResultId(response.data);
  const data = response.data?.data ?? response.data;
  return { resultId, duplicate: Boolean(data?.duplicate) };
};

const isOnlineNow = (): boolean =>
  typeof navigator === 'undefined' ? true : navigator.onLine;

export interface OfflineExamController {
  isOnline: boolean;
  prepareExam: (examId: string, title?: string | null) => Promise<PreparedExamRecord>;
  saveAnswer: (attemptId: string, questionId: string, value: string) => Promise<void>;
  queueSubmission: (
    attemptId: string,
    answers: Record<string, string>,
    questionIds: string[]
  ) => Promise<void>;
  syncPending: () => Promise<void>;
  reconcilePending: () => Promise<void>;
  markSubmitted: (attemptId: string, resultId: string) => Promise<void>;
  loadPreparedExam: (examId: string) => Promise<PreparedExamRecord | null>;
  listPrepared: () => Promise<PreparedExamRecord[]>;
  recoverAttempt: (attemptId: string) => ReturnType<typeof recoverOfflineAttempt>;
  removePrepared: (examId: string) => Promise<void>;
}

export const useOfflineExam = (): OfflineExamController => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [isOnline, setIsOnline] = useState(isOnlineNow);
  const syncingRef = useRef(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncPending = useCallback(async () => {
    if (!userId || syncingRef.current) return;
    syncingRef.current = true;
    try {
      await syncPendingSubmissions(userId, realSubmit);
    } finally {
      syncingRef.current = false;
    }
  }, [userId]);

  const reconcilePending = useCallback(async () => {
    if (!userId || !isOnlineNow()) return;
    await reconcileFinalizedAttempts(userId, async (attemptId) => {
      const response = await apiClient.get(`/exams/user/attempts/${attemptId}`);
      return response.data?.data ?? response.data;
    });
  }, [userId]);

  // Retry pending work on startup and whenever connectivity returns.
  useEffect(() => {
    if (!isOnline || !userId) return;
    void reconcilePending();
    void syncPending();
  }, [isOnline, userId, reconcilePending, syncPending]);

  const prepareExam = useCallback(
    (examId: string, title?: string | null) =>
      prepareExamForOffline({ userId: userId ?? '', examId, title }, realApi),
    [userId]
  );

  const saveAnswer = useCallback(
    (attemptId: string, questionId: string, value: string) =>
      saveOfflineAnswer(userId ?? '', attemptId, questionId, value),
    [userId]
  );

  const queueSubmission = useCallback(
    async (
      attemptId: string,
      answers: Record<string, string>,
      questionIds: string[]
    ): Promise<void> => {
      await queueOfflineSubmission(userId ?? '', attemptId, answers, questionIds);
    },
    [userId]
  );

  const markSubmitted = useCallback(
    (attemptId: string, resultId: string) =>
      markAttemptSubmitted(attemptId, resultId),
    []
  );

  const loadPreparedExam = useCallback(
    async (examId: string): Promise<PreparedExamRecord | null> => {
      if (!userId) return null;
      const result = await loadPreparedExamForStart(userId, examId);
      return result.ok && result.exam ? result.exam : null;
    },
    [userId]
  );

  const listPrepared = useCallback(
    () => (userId ? listPreparedExamsForUser(userId) : Promise.resolve([])),
    [userId]
  );

  const recoverAttempt = useCallback(
    (attemptId: string) => recoverOfflineAttempt(userId ?? '', attemptId),
    [userId]
  );

  const removePrepared = useCallback((examId: string) => {
    // Key mirrors offlineExamKey(examId, '') => offline:exam:<examId>.
    return removePreparedExam(`offline:exam:${examId}`);
  }, []);

  return {
    isOnline,
    prepareExam,
    saveAnswer,
    queueSubmission,
    syncPending,
    reconcilePending,
    markSubmitted,
    loadPreparedExam,
    listPrepared,
    recoverAttempt,
    removePrepared,
  };
};
