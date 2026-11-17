import { useCallback } from 'react';
import { ExamProgressState } from '@/shared/types/app';
import { STORAGE_KEYS } from '@/shared/constants/storageKeys';
import { StorageUtils, AnyStorageKey } from '@/shared/utils/storage';

/**
 * Local-only exam resume helpers.
 *
 * `exam_progress` is server-owned: RLS is enabled, the student policy is gone
 * and anon/authenticated have no table privileges, so the browser must never
 * read or write it. This hook now persists a convenience snapshot locally and
 * treats local storage as a hint only — the authoritative attempt state always
 * comes from the backend attempt API.
 *
 * The exported API (saveProgress / loadProgress / clearProgress) is unchanged.
 */

interface SaveProgressPayload {
  examId: string;
  state: ExamProgressState;
  /** Retained for call-site compatibility; no server sync happens. */
  userId?: string;
}

interface ClearProgressPayload {
  examId: string;
  userId?: string;
}

const storageKeyFor = (examId: string): AnyStorageKey =>
  `${STORAGE_KEYS.EXAM_PROGRESS_PREFIX}${examId}` as AnyStorageKey;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * Validates and normalises a stored snapshot. Anything malformed is discarded
 * instead of being handed to the exam UI as if it were trustworthy.
 */
const parseStoredProgress = (raw: unknown, examId: string): ExamProgressState | null => {
  if (!isRecord(raw)) return null;

  const answersSource = isRecord(raw.answers_draft) ? raw.answers_draft : {};
  const answers_draft: Record<string, number> = {};

  for (const [questionId, value] of Object.entries(answersSource)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      answers_draft[questionId] = value;
    }
  }

  const index = Number(raw.currentQuestionIndex);
  const timeRemaining = Number(raw.timeRemaining);

  const allowedStatuses: Array<ExamProgressState['status']> = [
    'idle',
    'running',
    'paused',
  ];

  const status = allowedStatuses.includes(raw.status as ExamProgressState['status'])
    ? (raw.status as ExamProgressState['status'])
    : 'idle';

  return {
    exam_id: typeof raw.exam_id === 'string' && raw.exam_id ? raw.exam_id : examId,
    currentQuestionIndex:
      Number.isFinite(index) && index >= 0 ? Math.floor(index) : 0,
    answers_draft,
    timeRemaining: Number.isFinite(timeRemaining) && timeRemaining >= 0 ? timeRemaining : 0,
    status,
    isComplete: raw.isComplete === true,
  };
};

export const useExamResume = () => {
  const saveProgress = useCallback(
    async (examId: string, state: ExamProgressState, _userId?: string): Promise<void> => {
      if (!examId) return;

      try {
        if (state.status === 'finished') {
          StorageUtils.remove(storageKeyFor(examId));
          return;
        }

        // Only plain progress data is stored — never tokens or session data.
        StorageUtils.set(storageKeyFor(examId), {
          exam_id: examId,
          currentQuestionIndex: state.currentQuestionIndex,
          answers_draft: state.answers_draft,
          timeRemaining: state.timeRemaining,
          status: state.status,
          isComplete: state.isComplete,
        });
      } catch (error) {
        console.error('Failed to save exam progress locally:', error);
      }
    },
    []
  );

  const loadProgress = useCallback(
    async (examId: string, _userId?: string): Promise<ExamProgressState | null> => {
      if (!examId) return null;

      try {
        const stored = StorageUtils.get<unknown>(storageKeyFor(examId));
        return parseStoredProgress(stored, examId);
      } catch (error) {
        console.error('Failed to load exam progress locally:', error);
        return null;
      }
    },
    []
  );

  const clearProgress = useCallback(
    async (examId: string, _userId?: string): Promise<void> => {
      if (!examId) return;

      try {
        StorageUtils.remove(storageKeyFor(examId));
      } catch (error) {
        console.error('Failed to clear exam progress locally:', error);
      }
    },
    []
  );

  return { saveProgress, loadProgress, clearProgress };
};

export type { SaveProgressPayload, ClearProgressPayload };
