import apiClient from '@/shared/lib/apiClient';
import type { Question } from '@/features/exam/types/exam';
import type {
  AttemptQuestion,
  AttemptQuestionsResponse,
  MistakePool,
  PracticeAnswerReveal,
  PracticeAttempt,
  PracticeStartResult,
} from '../types/practice';

type ApiEnvelope<T> = { data?: T };

type RawAttemptQuestionsResponse = Omit<AttemptQuestionsResponse, 'questions'> & {
  questions?: AttemptQuestion[] | null;
};

const unwrap = <T>(payload: unknown): T => {
  const envelope = payload as ApiEnvelope<T> | null;

  if (envelope && typeof envelope === 'object' && 'data' in envelope && envelope.data !== undefined) {
    return envelope.data;
  }

  return payload as T;
};

const normalizeAttempt = (attempt: PracticeAttempt): PracticeAttempt => ({
  ...attempt,
  answers_draft:
    attempt.answers_draft && typeof attempt.answers_draft === 'object'
      ? attempt.answers_draft
      : {},
  current_question_index: Number.isFinite(Number(attempt.current_question_index))
    ? Math.max(0, Math.trunc(Number(attempt.current_question_index)))
    : 0,
  question_ids: Array.isArray(attempt.question_ids) ? attempt.question_ids : [],
  practice_mode: attempt.practice_mode ?? null,
  source_history_id: attempt.source_history_id ?? null,
});

const mapAttemptQuestion = (question: AttemptQuestion): Question => {
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
          image_url: body.image_url ?? null,
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

export const practiceService = {
  async getMistakePool(): Promise<MistakePool> {
    const response = await apiClient.get('/exams/user/practice/mistakes');
    const payload = unwrap<MistakePool>(response.data);
    const count = Number(payload?.available_count);

    return {
      available_count: Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0,
    };
  },

  async startRetake(historyId: string, confirmPartial = false): Promise<PracticeStartResult> {
    const response = await apiClient.post(
      '/exams/user/practice/retake',
      {
        history_id: historyId,
        confirm_partial: confirmPartial,
      }
    );

    return unwrap<PracticeStartResult>(response.data);
  },

  async startWrongFromHistory(historyId: string): Promise<PracticeStartResult> {
    const response = await apiClient.post('/exams/user/practice/wrong', {
      history_id: historyId,
    });

    return unwrap<PracticeStartResult>(response.data);
  },

  async startMistakePractice(
    count: number,
    confirmReduced = false
  ): Promise<PracticeStartResult> {
    const response = await apiClient.post('/exams/user/practice/mistakes', {
      count,
      confirm_reduced: confirmReduced,
    });

    return unwrap<PracticeStartResult>(response.data);
  },

  async getAttemptState(attemptId: string): Promise<PracticeAttempt> {
    const response = await apiClient.get(
      `/exams/user/attempts/${encodeURIComponent(attemptId)}`
    );

    return normalizeAttempt(unwrap<PracticeAttempt>(response.data));
  },

  async getAttemptQuestions(attemptId: string): Promise<AttemptQuestionsResponse> {
    const response = await apiClient.get(
      `/exams/user/attempts/${encodeURIComponent(attemptId)}/questions`
    );
    const payload = unwrap<RawAttemptQuestionsResponse>(response.data);

    return {
      attempt_id: payload?.attempt_id ?? '',
      exam_id: payload?.exam_id ?? null,
      started_at: payload?.started_at ?? null,
      deadline_at: payload?.deadline_at ?? null,
      server_time: payload?.server_time ?? new Date().toISOString(),
      questions: Array.isArray(payload?.questions)
        ? payload.questions.map(mapAttemptQuestion)
        : [],
    };
  },

  async saveDraftAnswers(
    attemptId: string,
    answers: Record<string, string> | undefined,
    currentQuestionIndex = 0
  ): Promise<void> {
    await apiClient.patch(
      `/exams/user/attempts/${encodeURIComponent(attemptId)}/answers`,
      {
        // Omit the field entirely for position-only saves so the backend keeps
        // the latest answer draft written by the answer endpoint.
        ...(answers === undefined ? {} : { answers }),
        current_question_index: currentQuestionIndex,
      }
    );
  },

  async answerPracticeQuestion(
    attemptId: string,
    questionId: string,
    selectedOption: string
  ): Promise<PracticeAnswerReveal> {
    const response = await apiClient.post(
      `/exams/user/practice/${encodeURIComponent(attemptId)}/answer`,
      {
        question_id: questionId,
        selected_option: selectedOption,
      }
    );

    return unwrap<PracticeAnswerReveal>(response.data);
  },
};


type ErrorLike = {
  response?: {
    status?: number;
    data?: { message?: unknown };
  };
};

/** Uses the backend's actionable 4xx copy and a localized fallback otherwise. */
export const resolvePracticeError = (error: unknown, fallback: string): string => {
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
