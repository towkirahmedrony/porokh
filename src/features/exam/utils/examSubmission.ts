/**
 * Pure helpers for the examination submission flow.
 *
 * They are deliberately free of React so the submission contract can be tested
 * directly (see `examSubmission.test.ts`). `Arena` owns the state; this module
 * only describes what is sent, what a successful response must contain, and
 * which message a student should see.
 */

export type ExamAnswers = Record<string, string>;

export type SubmitPayloadInput = {
  examId?: string | null;
  attemptId?: string | null;
  sessionId?: string | null;
  answers: ExamAnswers;
  questionIds: string[];
  timeTaken: number;
};

export type SubmitPayload = {
  exam_id?: string;
  attempt_id?: string;
  session_id?: string;
  answers: ExamAnswers;
  time_taken: number;
  question_ids: string[];
};

/** Raised when a 2xx response does not carry a usable result id. */
export class MalformedSubmitResponseError extends Error {
  constructor() {
    super('Submission response did not include a result id');
    this.name = 'MalformedSubmitResponseError';
  }
}

/**
 * Builds the request body. Optional identifiers are omitted instead of being
 * sent as `null`, matching the backend's "absent means not applicable" contract.
 */
export const buildSubmitPayload = ({
  examId,
  attemptId,
  sessionId,
  answers,
  questionIds,
  timeTaken,
}: SubmitPayloadInput): SubmitPayload => {
  const payload: SubmitPayload = {
    answers: { ...answers },
    time_taken: Math.max(0, Math.round(Number(timeTaken) || 0)),
    question_ids: [...questionIds],
  };

  const normalizedExamId = typeof examId === 'string' ? examId.trim() : '';

  if (normalizedExamId) payload.exam_id = normalizedExamId;

  // Server-issued attempt id. When present the backend grades against the
  // frozen attempt question set and ignores any client-invented scope.
  const normalizedAttemptId = typeof attemptId === 'string' ? attemptId.trim() : '';

  if (normalizedAttemptId) payload.attempt_id = normalizedAttemptId;

  const normalizedSessionId = typeof sessionId === 'string' ? sessionId.trim() : '';

  if (normalizedSessionId) payload.session_id = normalizedSessionId;

  return payload;
};

const createRandomId = (): string => {
  const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;

  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  // Fallback for browsers without `crypto.randomUUID` (older Safari/iOS).
  return `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

/**
 * Returns a submission id that is stable for one examination session.
 *
 * Keeping it in `sessionStorage` means a page reload during a slow submission
 * reuses the same key, so the backend recognises the retry as a duplicate of
 * the result it may already have persisted instead of writing a second one.
 */
export const getOrCreateSubmissionId = (
  storageKey: string,
  storage: Storage | null = getSessionStorage()
): string => {
  if (storage) {
    try {
      const existing = storage.getItem(storageKey);

      if (existing && /^[A-Za-z0-9_-]{8,128}$/.test(existing)) return existing;
    } catch {
      // Storage can be unavailable (private mode / disabled cookies); the
      // in-memory id below is still a valid idempotency key for this mount.
    }
  }

  const created = createRandomId();

  if (storage) {
    try {
      storage.setItem(storageKey, created);
    } catch {
      // Ignore: persistence is a resilience improvement, not a requirement.
    }
  }

  return created;
};

export const clearSubmissionId = (
  storageKey: string,
  storage: Storage | null = getSessionStorage()
): void => {
  if (!storage) return;

  try {
    storage.removeItem(storageKey);
  } catch {
    // Ignore: a stale key only costs one extra duplicate lookup.
  }
};

export const buildSubmissionStorageKey = (scope: string): string =>
  `porokh.exam.submission.${scope}`;

function getSessionStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

type SubmitEnvelope = {
  data?: unknown;
  id?: unknown;
};

/**
 * Reads the persisted result id from a submission response.
 *
 * The API wraps payloads in `{ success, message, data }`, but a raw result is
 * also accepted for forward compatibility. A response without an id is treated
 * as a failure so the student is never sent to a result page that cannot exist.
 */
export const extractSubmittedResultId = (response: unknown): string => {
  const envelope = (response ?? {}) as SubmitEnvelope;
  const data =
    envelope.data && typeof envelope.data === 'object'
      ? (envelope.data as SubmitEnvelope)
      : envelope;

  const id = data?.id;

  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new MalformedSubmitResponseError();
  }

  return id.trim();
};

export type SubmitErrorMessages = {
  generic: string;
  network: string;
};

type ErrorLike = {
  response?: {
    status?: number;
    data?: { message?: unknown };
  };
  code?: string;
};

/**
 * Chooses the message a student sees for a failed submission.
 *
 * Client errors (4xx) carry an actionable server message; server errors (5xx)
 * and transport failures fall back to localised copy so internals never leak.
 */
export const resolveSubmitErrorMessage = (
  error: unknown,
  messages: SubmitErrorMessages
): string => {
  const candidate = (error ?? {}) as ErrorLike;
  const status = candidate.response?.status;
  const serverMessage = candidate.response?.data?.message;

  if (
    typeof status === 'number' &&
    status >= 400 &&
    status < 500 &&
    typeof serverMessage === 'string' &&
    serverMessage.trim().length > 0
  ) {
    return serverMessage.trim();
  }

  if (!candidate.response) return messages.network;

  return messages.generic;
};
