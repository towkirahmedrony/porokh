import apiClient from '@/shared/lib/apiClient';
import type { Question } from '@/features/exam/types/exam';
import type {
  AdmissionAttempt,
  AdmissionAttemptQuestion,
  AdmissionAttemptQuestionsResponse,
} from '../types/admission';

/**
 * Thin client for the existing secure attempt lifecycle:
 *
 *   POST  /exams/user/attempts/start        -> server-issued attempt + deadline
 *   GET   /exams/user/attempts/:id/questions -> sanitized questions (no key)
 *   PATCH /exams/user/attempts/:id/answers   -> draft answers
 *   POST  /exams/user/submit                -> trusted grading by attempt id
 *
 * These endpoints already exist in parapoth-backend; the admission feature
 * only consumes them. No score is calculated on the client.
 */

type ApiEnvelope<T> = { data?: T };

const unwrap = <T>(payload: unknown): T => {
  const envelope = payload as ApiEnvelope<T> | null;
  if (envelope && typeof envelope === 'object' && 'data' in envelope && envelope.data) {
    return envelope.data;
  }
  return payload as T;
};

const normalizeDraftAnswers = (
  value: Record<string, string> | null | undefined
): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const answers: Record<string, string> = {};
  for (const [questionId, optionId] of Object.entries(value)) {
    if (optionId === null || optionId === undefined) continue;
    answers[questionId] = String(optionId);
  }
  return answers;
};

const normalizeAttempt = (attempt: AdmissionAttempt): AdmissionAttempt => ({
  ...attempt,
  answers_draft: normalizeDraftAnswers(attempt.answers_draft),
  current_question_index: Number.isFinite(Number(attempt.current_question_index))
    ? Math.max(0, Math.trunc(Number(attempt.current_question_index)))
    : 0,
  question_ids: Array.isArray(attempt.question_ids) ? attempt.question_ids : [],
});

export const admissionExamService = {
  async startAttempt(examId: string): Promise<AdmissionAttempt> {
    const response = await apiClient.post('/exams/user/attempts/start', {
      exam_id: examId,
    });

    return normalizeAttempt(unwrap<AdmissionAttempt>(response.data));
  },

  async getAttemptQuestions(
    attemptId: string
  ): Promise<AdmissionAttemptQuestionsResponse> {
    const response = await apiClient.get(
      `/exams/user/attempts/${encodeURIComponent(attemptId)}/questions`
    );

    const payload = unwrap<AdmissionAttemptQuestionsResponse>(response.data);

    return {
      ...payload,
      questions: Array.isArray(payload?.questions) ? payload.questions : [],
    };
  },

  async saveDraftAnswers(
    attemptId: string,
    answers: Record<string, string>,
    currentQuestionIndex: number
  ): Promise<void> {
    await apiClient.patch(
      `/exams/user/attempts/${encodeURIComponent(attemptId)}/answers`,
      {
        answers,
        current_question_index: Math.max(0, Math.trunc(currentQuestionIndex)),
      }
    );
  },
};

/**
 * Converts the sanitized attempt question into the shared `Question` shape
 * consumed by `QuestionCard`/`AnswerOption` rendering. The helper keeps the
 * backend option ids as strings so answer selection matches trusted grading.
 */
export const mapAttemptQuestion = (
  question: AdmissionAttemptQuestion
): Question => {
  const body = question.body ?? null;
  const questionTextBn = body?.text_bn ?? body?.text_en ?? '';

  return {
    ...(question as unknown as Question),
    text_bn: questionTextBn,
    text: body?.text_en ?? questionTextBn,
    body: (body
      ? {
          text_bn: body.text_bn ?? body.text_en ?? '',
          text_en: body.text_en ?? null,
        }
      : null) as Question['body'],
    image_url: body?.image_url ?? undefined,
    options: (question.options ?? []).map((option) => ({
      id: String(option.id),
      text: option.text_bn ?? option.text_en ?? '',
      text_bn: option.text_bn ?? option.text_en ?? '',
      text_en: option.text_en ?? null,
      image_url: option.image_url ?? null,
    })),
  };
};

type ErrorLike = {
  response?: {
    status?: number;
    data?: { message?: unknown };
  };
};

/**
 * Uses the backend's actionable 4xx message (not started, window closed,
 * attempt expired) and a localized fallback for transport/server failures.
 */
export const resolveAdmissionExamError = (
  error: unknown,
  fallback: string
): string => {
  const candidate = (error ?? {}) as ErrorLike;
  const status = candidate.response?.status;
  const message = candidate.response?.data?.message;

  if (
    typeof status === 'number' &&
    status >= 400 &&
    status < 500 &&
    typeof message === 'string' &&
    message.trim().length > 0
  ) {
    return message.trim();
  }

  return fallback;
};
