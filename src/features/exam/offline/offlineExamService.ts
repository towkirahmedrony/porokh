import {
  getOfflineExamStorage,
  type OfflineExamStorage,
} from './storage';
import {
  OFFLINE_SCHEMA_VERSION,
  type AnswerRecord,
  type ExamAttemptRecord,
  type PreparedExamRecord,
  type PreparedExamValidation,
  type SubmissionRecord,
} from './types';

/**
 * Offline exam orchestrator.
 *
 * The authoritative attempt lifecycle stays server-side: preparing an exam
 * starts (or resumes) a server-issued attempt online, then caches its frozen
 * question set and deadline locally. Offline work is therefore always covered
 * by the backend's ownership, eligibility and grading rules — the client never
 * invents an attempt id, score, deadline or answer key.
 */

// ---------------------------------------------------------------------------
// API adapters (injected so the service stays testable without a network)
// ---------------------------------------------------------------------------

export interface StartedAttempt {
  id: string;
  exam_id: string | null;
  kind: string;
  started_at: string | null;
  deadline_at: string | null;
  seconds_remaining: number | null;
  question_ids: string[];
}

export interface AttemptQuestionsPayload {
  attempt_id: string;
  exam_id: string | null;
  started_at: string | null;
  deadline_at: string | null;
  server_time: string;
  questions: unknown[];
}

export interface OfflineExamApi {
  startAttempt(userId: string, examId: string): Promise<StartedAttempt>;
  getAttemptQuestions(
    userId: string,
    attemptId: string
  ): Promise<AttemptQuestionsPayload>;
}

export interface SubmitOutcome {
  resultId: string;
  duplicate: boolean;
}

export type SubmitPayload = {
  attemptId?: string;
  examId?: string | null;
  sessionId?: string;
  answers: Record<string, string>;
  questionIds: string[];
  timeTaken: number;
};

export type SubmitFn = (payload: SubmitPayload) => Promise<SubmitOutcome>;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export const offlineExamKey = (
  examId: string | null,
  attemptId: string
): string => (examId ? `offline:exam:${examId}` : `offline:practice:${attemptId}`);

export const parseIsoMs = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};

/** Remaining seconds for a deadline; never negative, never extrapolated. */
export const computeRemainingSeconds = (
  deadlineAt: string | null,
  nowMs: number
): number | null => {
  const deadline = parseIsoMs(deadlineAt);
  if (deadline === null) return null;
  return Math.max(0, Math.ceil((deadline - nowMs) / 1000));
};

export const isAttemptExpired = (
  deadlineAt: string | null,
  nowMs: number
): boolean => {
  const remaining = computeRemainingSeconds(deadlineAt, nowMs);
  return remaining !== null && remaining <= 0;
};

/** Validates a prepared dataset before it may be started offline. */
export const validatePreparedExam = (
  exam: PreparedExamRecord | null,
  nowMs = Date.now()
): PreparedExamValidation => {
  if (!exam) return { ok: false, reason: 'missing' };
  if (exam.schemaVersion !== OFFLINE_SCHEMA_VERSION) {
    return { ok: false, reason: 'schema_incompatible' };
  }
  if (isAttemptExpired(exam.deadlineAt, nowMs)) {
    return { ok: false, reason: 'expired' };
  }

  const complete =
    Array.isArray(exam.questions) &&
    Array.isArray(exam.questionIds) &&
    exam.questionIds.length > 0 &&
    exam.questions.length === exam.questionIds.length &&
    exam.questions.every(
      (question) =>
        question &&
        typeof question.id === 'string' &&
        question.id.length > 0 &&
        Array.isArray(question.options) &&
        question.options.length > 0
    );

  if (!complete) return { ok: false, reason: 'incomplete' };

  const ids = new Set(exam.questionIds);
  const coherent = exam.questions.every((question) => ids.has(question.id));
  if (!coherent) return { ok: false, reason: 'corrupted' };

  return { ok: true };
};

/** The next monotonic revision for one answer, given existing answers. */
export const nextAnswerRevision = (
  existing: AnswerRecord[],
  questionId: string
): number => {
  let max = 0;
  for (const answer of existing) {
    if (answer.questionId === questionId && answer.revision > max) {
      max = answer.revision;
    }
  }
  return max + 1;
};

export const submissionIdempotencyKey = (attemptId: string): string =>
  `offline-sub-${attemptId}`;

// ---------------------------------------------------------------------------
// Preparation
// ---------------------------------------------------------------------------

export interface PrepareExamInput {
  userId: string;
  examId: string;
  title?: string | null;
  nowMs?: number;
}

export class OfflinePrepareError extends Error {
  constructor(message: string, readonly reason?: string) {
    super(message);
    this.name = 'OfflinePrepareError';
  }
}

/** Starts the authoritative attempt online and caches its complete dataset. */
export const prepareExamForOffline = async (
  input: PrepareExamInput,
  api: OfflineExamApi,
  storage: OfflineExamStorage = getOfflineExamStorage()
): Promise<PreparedExamRecord> => {
  const nowMs = input.nowMs ?? Date.now();
  await storage.init();

  const attempt = await api.startAttempt(input.userId, input.examId);
  if (!attempt?.id) {
    throw new OfflinePrepareError('Server did not issue an attempt', 'incomplete');
  }

  const questionsPayload = await api.getAttemptQuestions(
    input.userId,
    attempt.id
  );

  const questionIds = (attempt.question_ids ?? []).slice();
  const rawQuestions = Array.isArray(questionsPayload.questions)
    ? questionsPayload.questions
    : [];
  const questions = rawQuestions.map((question) =>
    question && typeof question === 'object'
      ? (question as PreparedExamRecord['questions'][number])
      : ({ id: '', options: [] } as PreparedExamRecord['questions'][number])
  );

  const startedAt = questionsPayload.started_at ?? attempt.started_at;
  const deadlineAt = questionsPayload.deadline_at ?? attempt.deadline_at;

  const prepared: PreparedExamRecord = {
    key: offlineExamKey(attempt.exam_id ?? input.examId, attempt.id),
    examId: attempt.exam_id ?? input.examId,
    attemptId: attempt.id,
    kind: attempt.exam_id ? 'exam' : 'practice',
    title: input.title ?? null,
    durationSeconds: computeDurationSeconds(startedAt, deadlineAt),
    startedAt: startedAt ?? new Date(nowMs).toISOString(),
    deadlineAt: deadlineAt ?? new Date(nowMs).toISOString(),
    questionIds,
    questions,
    schemaVersion: OFFLINE_SCHEMA_VERSION,
    preparedAt: new Date(nowMs).toISOString(),
    userId: input.userId,
  };

  const validation = validatePreparedExam(prepared, nowMs);
  if (!validation.ok) {
    throw new OfflinePrepareError(
      `Prepared dataset is not complete: ${validation.reason}`,
      validation.reason
    );
  }

  await storage.putPreparedExam(prepared);

  // The server attempt is already in_progress; mirror it locally so the OTA
  // gate blocks activation until the attempt is resolved.
  const attemptRecord: ExamAttemptRecord = {
    key: `admission:${attempt.id}`,
    userId: input.userId,
    scope: 'admission',
    attemptId: attempt.id,
    examId: prepared.examId ?? '',
    status: 'in_progress',
    offlinePolicy: 'offline_allowed',
    startedAt: parseIsoMs(startedAt),
    deadlineAt: parseIsoMs(deadlineAt),
    serverTimeAtSync: null,
    clientTimeAtSync: nowMs,
    wallHighWaterMs: null,
    secondsRemainingAtSync: computeRemainingSeconds(deadlineAt, nowMs),
    durationSeconds: prepared.durationSeconds,
    questionIds,
    questionsVersion: null,
    prepared: true,
    currentIndex: 0,
    lastServerUpdatedAt: null,
    lastSyncedAt: null,
    lastSyncError: null,
    syncAttempts: 0,
    nextSyncAt: null,
    submissionId: null,
    createdAt: new Date(nowMs).toISOString(),
    updatedAt: new Date(nowMs).toISOString(),
  };
  await storage.putAttempt(attemptRecord);

  return prepared;
};

const computeDurationSeconds = (
  startedAt: string | null,
  deadlineAt: string | null
): number => {
  const start = parseIsoMs(startedAt);
  const end = parseIsoMs(deadlineAt);
  if (start === null || end === null) return 0;
  return Math.max(0, Math.round((end - start) / 1000));
};

/** Reads and validates a prepared exam for a user before offline start. */
export const loadPreparedExamForStart = async (
  userId: string,
  examId: string,
  storage: OfflineExamStorage = getOfflineExamStorage(),
  nowMs = Date.now()
): Promise<PreparedExamValidation & { exam?: PreparedExamRecord }> => {
  await storage.init();
  const prepared = await storage.getPreparedExam(offlineExamKey(examId, ''));

  if (prepared && prepared.userId !== userId) {
    return { ok: false, reason: 'missing' };
  }

  const validation = validatePreparedExam(prepared, nowMs);
  return validation.ok ? { ok: true, exam: prepared ?? undefined } : validation;
};

export const listPreparedExamsForUser = async (
  userId: string,
  storage: OfflineExamStorage = getOfflineExamStorage()
): Promise<PreparedExamRecord[]> => {
  await storage.init();
  return storage.listPreparedExams(userId);
};

export const removePreparedExam = async (
  key: string,
  storage: OfflineExamStorage = getOfflineExamStorage()
): Promise<void> => {
  await storage.init();
  await storage.removePreparedExam(key);
};

// ---------------------------------------------------------------------------
// Answer persistence
// ---------------------------------------------------------------------------

/** Durably persists one answer; stale revisions never overwrite newer ones. */
export const saveOfflineAnswer = async (
  userId: string,
  attemptId: string,
  questionId: string,
  value: string,
  storage: OfflineExamStorage = getOfflineExamStorage(),
  nowMs = Date.now()
): Promise<void> => {
  await storage.init();
  const existing = await storage.getAnswers(attemptId);
  const revision = nextAnswerRevision(existing, questionId);

  const answer: AnswerRecord = {
    id: `${attemptId}:${questionId}`,
    attemptId,
    userId,
    questionId,
    value: String(value),
    revision,
    operationId: `op-${attemptId}-${questionId}-${revision}-${nowMs}`,
    updatedAt: new Date(nowMs).toISOString(),
    status: 'pending',
    lastError: null,
  };

  await storage.putAnswerIfNewer(answer);
};

/** Mark local work complete only after an authenticated server confirmation. */
export const markAttemptSubmitted = async (
  attemptId: string,
  resultId: string | null,
  storage: OfflineExamStorage = getOfflineExamStorage(),
  nowMs = Date.now()
): Promise<void> => {
  await storage.init();
  const submission = await storage.getSubmission(attemptId);
  if (submission) {
    await storage.putSubmission({
      ...submission,
      status: 'confirmed',
      resultId: resultId ?? submission.resultId,
      lastError: null,
      updatedAt: new Date(nowMs).toISOString(),
    });
  }
  const attempt = await storage.getAttempt(attemptId);
  if (attempt) {
    await storage.putAttempt({
      ...attempt,
      status: 'submitted',
      submissionId: resultId ?? attempt.submissionId,
      lastSyncedAt: new Date(nowMs).toISOString(),
      lastSyncError: null,
      updatedAt: new Date(nowMs).toISOString(),
    });
  }
  for (const answer of await storage.getAnswers(attemptId)) {
    if (answer.status === 'synced') continue;
    await storage.putAnswerIfNewer({
      ...answer,
      status: 'synced',
      lastError: null,
      updatedAt: new Date(nowMs).toISOString(),
      revision: answer.revision + 1,
    });
  }
};

export type AttemptStatusLookup = (attemptId: string) => Promise<{
  id?: string;
  status?: string;
  exam_history_id?: string | null;
}>;

/** Recover records left by older builds without trusting ambiguous failures. */
export const reconcileFinalizedAttempts = async (
  userId: string,
  lookup: AttemptStatusLookup,
  storage: OfflineExamStorage = getOfflineExamStorage()
): Promise<void> => {
  if (!userId) return;
  await storage.init();
  const pending = (await storage.listAnswersForUser(userId)).filter(
    (answer) => answer.status !== 'synced'
  );
  const attemptIds = [...new Set(pending.map((answer) => answer.attemptId))];
  for (const attemptId of attemptIds) {
    try {
      const remote = await lookup(attemptId);
      if (remote.id !== attemptId) continue;
      if (remote.status !== 'submitted' && remote.status !== 'finalized') continue;
      await markAttemptSubmitted(attemptId, remote.exam_history_id ?? null, storage);
    } catch {
      // Network/auth/server errors never prove that an answer was submitted.
    }
  }
};

/** Rehydrates an active attempt plus its durable answers. */
export const recoverOfflineAttempt = async (
  userId: string,
  attemptId: string,
  storage: OfflineExamStorage = getOfflineExamStorage()
): Promise<{ attempt: ExamAttemptRecord | null; answers: AnswerRecord[] }> => {
  await storage.init();
  const attempt = await storage.getAttempt(attemptId);
  if (attempt && attempt.userId !== userId) {
    return { attempt: null, answers: [] };
  }
  const answers = await storage.getAnswers(attemptId);
  return { attempt, answers };
};

// ---------------------------------------------------------------------------
// Submission queue
// ---------------------------------------------------------------------------

export const MAX_SYNC_ATTEMPTS = 8;
const SYNC_BACKOFF_BASE_MS = 5_000;
const SYNC_BACKOFF_MAX_MS = 6 * 60 * 60 * 1000;

export const syncBackoffMs = (attempts: number): number =>
  Math.min(SYNC_BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1), SYNC_BACKOFF_MAX_MS);

/** Durably queues a submission; survives reload and stays idempotent. */
export const queueOfflineSubmission = async (
  userId: string,
  attemptId: string,
  answers: Record<string, string>,
  questionIds: string[],
  storage: OfflineExamStorage = getOfflineExamStorage(),
  nowMs = Date.now()
): Promise<SubmissionRecord> => {
  await storage.init();
  const existing = await storage.getSubmission(attemptId);
  if (existing && existing.status === 'confirmed') return existing;

  const submission: SubmissionRecord = {
    attemptId,
    userId,
    status: 'pending',
    idempotencyKey: submissionIdempotencyKey(attemptId),
    payload: {
      attempt_id: attemptId,
      answers: { ...answers },
      question_ids: [...questionIds],
    },
    createdAt: existing?.createdAt ?? new Date(nowMs).toISOString(),
    updatedAt: new Date(nowMs).toISOString(),
    attempts: existing?.attempts ?? 0,
    lastAttemptAt: existing?.lastAttemptAt ?? null,
    nextAttemptAt: nowMs,
    lastError: existing?.lastError ?? null,
    resultId: existing?.resultId ?? null,
    result: existing?.result ?? null,
  };

  await storage.putSubmission(submission);
  return submission;
};

export interface SyncResult {
  attemptId: string;
  outcome: 'confirmed' | 'deferred' | 'failed';
  duplicate: boolean;
}

/**
 * Retries every pending submission exactly-once-at-most per attempt and marks
 * the local state confirmed only after the server confirms the result. Network
 * failures and retryable server errors defer with bounded backoff; terminal
 * client errors (4xx) mark the submission failed without discarding it.
 */
export const syncPendingSubmissions = async (
  userId: string,
  submit: SubmitFn,
  storage: OfflineExamStorage = getOfflineExamStorage(),
  nowMs = Date.now()
): Promise<SyncResult[]> => {
  await storage.init();
  const submissions = (await storage.listSubmissionsForUser(userId)).filter(
    (submission) => submission.status === 'pending' || submission.status === 'failed'
  );

  const results: SyncResult[] = [];

  for (const submission of submissions) {
    if (submission.nextAttemptAt && submission.nextAttemptAt > nowMs) {
      results.push({ attemptId: submission.attemptId, outcome: 'deferred', duplicate: false });
      continue;
    }

    const payload = submission.payload as {
      attempt_id?: string;
      exam_id?: string | null;
      session_id?: string;
      answers?: Record<string, string>;
      question_ids?: string[];
    };

    try {
      const outcome = await submit({
        attemptId: payload.attempt_id ?? submission.attemptId,
        examId: payload.exam_id ?? null,
        sessionId: payload.session_id,
        answers: (payload.answers ?? {}) as Record<string, string>,
        questionIds: (payload.question_ids ?? []) as string[],
        timeTaken: 0,
      });

      await markSubmissionConfirmed(
        submission.attemptId,
        outcome.resultId,
        outcome.duplicate,
        storage,
        nowMs
      );
      results.push({
        attemptId: submission.attemptId,
        outcome: 'confirmed',
        duplicate: outcome.duplicate,
      });
    } catch (error) {
      const terminal = isTerminalSyncError(error);
      const attempts = submission.attempts + 1;
      const nextAttemptAt = terminal
        ? null
        : nowMs + syncBackoffMs(attempts);

      await storage.putSubmission({
        ...submission,
        status: terminal ? 'failed' : 'pending',
        attempts,
        lastAttemptAt: nowMs,
        nextAttemptAt,
        lastError: error instanceof Error ? error.message : String(error),
        updatedAt: new Date(nowMs).toISOString(),
      });

      results.push({
        attemptId: submission.attemptId,
        outcome: terminal ? 'failed' : 'deferred',
        duplicate: false,
      });
    }
  }

  return results;
};

const isTerminalSyncError = (error: unknown): boolean => {
  const candidate = error as { response?: { status?: number } };
  const status = candidate?.response?.status;
  return typeof status === 'number' && status >= 400 && status < 500;
};

const markSubmissionConfirmed = async (
  attemptId: string,
  resultId: string,
  duplicate: boolean,
  storage: OfflineExamStorage,
  nowMs: number
): Promise<void> => {
  const submission = await storage.getSubmission(attemptId);
  if (submission) {
    await storage.putSubmission({
      ...submission,
      status: 'confirmed',
      resultId,
      result: { resultId, duplicate },
      lastError: null,
      updatedAt: new Date(nowMs).toISOString(),
    });
  }

  const attempt = await storage.getAttempt(attemptId);
  if (attempt) {
    await storage.putAttempt({
      ...attempt,
      status: 'submitted',
      submissionId: resultId,
      lastSyncedAt: new Date(nowMs).toISOString(),
      updatedAt: new Date(nowMs).toISOString(),
    });
  }

  // Answers are now captured by the confirmed submission.
  const answers = await storage.getAnswers(attemptId);
  for (const answer of answers) {
    await storage.putAnswerIfNewer({
      ...answer,
      status: 'synced',
      updatedAt: new Date(nowMs).toISOString(),
      revision: answer.revision + 1,
    });
  }
};
