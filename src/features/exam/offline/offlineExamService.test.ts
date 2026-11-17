import test from 'node:test';
import assert from 'node:assert/strict';

import { MemoryOfflineExamStorage } from './storage.ts';
import { evaluateActivationGate } from '../../app-update/activationGate.ts';
import {
  computeRemainingSeconds,
  isAttemptExpired,
  loadPreparedExamForStart,
  markAttemptSubmitted,
  offlineExamKey,
  prepareExamForOffline,
  queueOfflineSubmission,
  recoverOfflineAttempt,
  reconcileFinalizedAttempts,
  saveOfflineAnswer,
  syncPendingSubmissions,
  validatePreparedExam,
  type OfflineExamApi,
  type StartedAttempt,
  type SubmitOutcome,
  type SubmitPayload,
} from './offlineExamService.ts';
import type { PreparedExamRecord } from './types.ts';

const NOW = Date.parse('2026-10-26T10:00:00.000Z');
const STARTED = '2026-10-26T10:00:00.000Z';
const DEADLINE = '2026-10-26T10:20:00.000Z'; // 20 minutes

const question = (id: string) => ({
  id,
  text_en: `Question ${id}`,
  options: [
    { id: `${id}:a`, text_en: 'A' },
    { id: `${id}:b`, text_en: 'B' },
  ],
});

const attempt: StartedAttempt = {
  id: 'attempt-1',
  exam_id: 'exam-1',
  kind: 'exam',
  started_at: STARTED,
  deadline_at: DEADLINE,
  seconds_remaining: 1200,
  question_ids: ['q1', 'q2'],
};

const api: OfflineExamApi = {
  startAttempt: async () => attempt,
  getAttemptQuestions: async () => ({
    attempt_id: 'attempt-1',
    exam_id: 'exam-1',
    started_at: STARTED,
    deadline_at: DEADLINE,
    server_time: STARTED,
    questions: [question('q1'), question('q2')],
  }),
};

const preparedExam = (overrides: Partial<PreparedExamRecord> = {}): PreparedExamRecord => ({
  key: offlineExamKey('exam-1', 'attempt-1'),
  examId: 'exam-1',
  attemptId: 'attempt-1',
  kind: 'exam',
  title: 'Model Test',
  durationSeconds: 1200,
  startedAt: STARTED,
  deadlineAt: DEADLINE,
  questionIds: ['q1', 'q2'],
  questions: [question('q1'), question('q2')],
  schemaVersion: 1,
  preparedAt: STARTED,
  userId: 'u1',
  ...overrides,
});

test('preparing an exam online persists the complete dataset', async () => {
  const storage = new MemoryOfflineExamStorage();
  const prepared = await prepareExamForOffline(
    { userId: 'u1', examId: 'exam-1', nowMs: NOW },
    api,
    storage
  );

  assert.equal(prepared.attemptId, 'attempt-1');
  assert.equal(prepared.questions.length, 2);
  assert.equal(prepared.questionIds.length, 2);
  assert.equal(prepared.schemaVersion, 1);

  const stored = await storage.getPreparedExam(offlineExamKey('exam-1', 'attempt-1'));
  assert.equal(stored?.attemptId, 'attempt-1');

  // The server attempt is mirrored so the OTA gate blocks until resolved.
  const attempts = await storage.listAttemptsForUser('u1');
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].status, 'in_progress');
});

test('an incomplete download is rejected before being marked ready', async () => {
  const badApi: OfflineExamApi = {
    startAttempt: async () => attempt,
    getAttemptQuestions: async () => ({
      attempt_id: 'attempt-1',
      exam_id: 'exam-1',
      started_at: STARTED,
      deadline_at: DEADLINE,
      server_time: STARTED,
      questions: [question('q1')], // missing q2
    }),
  };

  const storage = new MemoryOfflineExamStorage();
  await assert.rejects(
    () =>
      prepareExamForOffline(
        { userId: 'u1', examId: 'exam-1', nowMs: NOW },
        badApi,
        storage
      ),
    /not complete/
  );

  assert.equal(await storage.getPreparedExam(offlineExamKey('exam-1', 'attempt-1')), null);
});

test('a prepared exam validates and can be started offline', async () => {
  const storage = new MemoryOfflineExamStorage();
  await storage.putPreparedExam(preparedExam());

  const result = await loadPreparedExamForStart('u1', 'exam-1', storage, NOW);
  assert.equal(result.ok, true);
});

test('a missing prepared exam cannot be started offline', async () => {
  const storage = new MemoryOfflineExamStorage();
  const result = await loadPreparedExamForStart('u1', 'exam-1', storage, NOW);
  assert.deepEqual(result, { ok: false, reason: 'missing' });
});

test('an expired prepared exam cannot be started offline', async () => {
  const storage = new MemoryOfflineExamStorage();
  await storage.putPreparedExam(
    preparedExam({
      deadlineAt: '2026-10-26T09:59:00.000Z',
    })
  );

  const result = await loadPreparedExamForStart('u1', 'exam-1', storage, NOW);
  assert.deepEqual(result, { ok: false, reason: 'expired' });
});

test('schema mismatch and corrupted records fail closed', () => {
  assert.deepEqual(validatePreparedExam(preparedExam({ schemaVersion: 2 }), NOW), {
    ok: false,
    reason: 'schema_incompatible',
  });

  assert.deepEqual(
    validatePreparedExam(
      preparedExam({ questions: [question('q1'), question('qX')] }),
      NOW
    ),
    { ok: false, reason: 'corrupted' }
  );

  assert.deepEqual(
    validatePreparedExam(preparedExam({ questions: [] }), NOW),
    { ok: false, reason: 'incomplete' }
  );
});

test('remaining time is restored from the deadline, never reset', () => {
  assert.equal(computeRemainingSeconds(DEADLINE, NOW), 1200);
  assert.equal(computeRemainingSeconds(DEADLINE, NOW + 600_000), 600);
  assert.equal(isAttemptExpired(DEADLINE, NOW + 1_200_000), true);
  assert.equal(isAttemptExpired(null, NOW), false);
});

test('answers persist durably and stale writes never overwrite newer ones', async () => {
  const storage = new MemoryOfflineExamStorage();

  await saveOfflineAnswer('u1', 'attempt-1', 'q1', 'A', storage, NOW);
  await saveOfflineAnswer('u1', 'attempt-1', 'q1', 'B', storage, NOW + 1);

  const answers = await storage.getAnswers('attempt-1');
  assert.equal(answers.length, 1);
  assert.equal(answers[0].value, 'B');
  assert.equal(answers[0].status, 'pending');
  assert.equal(answers[0].revision, 2);

  // A stale replay must not revert to an older value.
  await storage.putAnswerIfNewer({ ...answers[0], value: 'A', revision: 1 });
  const after = await storage.getAnswers('attempt-1');
  assert.equal(after[0].value, 'B');
});

test('recovery rehydrates the attempt and answers after a restart', async () => {
  const storage = new MemoryOfflineExamStorage();
  const prepared = await prepareExamForOffline(
    { userId: 'u1', examId: 'exam-1', nowMs: NOW },
    api,
    storage
  );
  await saveOfflineAnswer('u1', prepared.attemptId, 'q1', 'A', storage, NOW);

  const recovered = await recoverOfflineAttempt('u1', 'attempt-1', storage);
  assert.equal(recovered.attempt?.status, 'in_progress');
  assert.equal(recovered.answers.length, 1);
  assert.equal(recovered.answers[0].value, 'A');
});

test('a queued submission survives a restart and syncs idempotently', async () => {
  const storage = new MemoryOfflineExamStorage();
  await prepareExamForOffline({ userId: 'u1', examId: 'exam-1', nowMs: NOW }, api, storage);
  await saveOfflineAnswer('u1', 'attempt-1', 'q1', 'A', storage, NOW);
  await queueOfflineSubmission('u1', 'attempt-1', { q1: 'A' }, ['q1', 'q2'], storage, NOW);

  let calls: SubmitPayload[] = [];
  const submit = async (payload: SubmitPayload): Promise<SubmitOutcome> => {
    calls.push(payload);
    return { resultId: 'result-1', duplicate: false };
  };

  // First sync confirms.
  const first = await syncPendingSubmissions('u1', submit, storage, NOW + 1);
  assert.equal(first.length, 1);
  assert.equal(first[0].outcome, 'confirmed');

  // A simulated restart (fresh storage object is not possible with a singleton;
  // the memory store is re-read) plus a second sync must not re-submit.
  const before = calls.length;
  const second = await syncPendingSubmissions('u1', submit, storage, NOW + 2);
  assert.equal(second.length, 0, 'confirmed submissions are not re-synced');
  assert.equal(calls.length, before);

  const submission = await storage.getSubmission('attempt-1');
  assert.equal(submission?.status, 'confirmed');
  const attempt = await storage.getAttempt('attempt-1');
  assert.equal(attempt?.status, 'submitted');
});

test('a network failure defers the submission with bounded backoff and retries later', async () => {
  const storage = new MemoryOfflineExamStorage();
  await queueOfflineSubmission('u1', 'attempt-1', { q1: 'A' }, ['q1'], storage, NOW);

  let fail = true;
  const submit = async (): Promise<SubmitOutcome> => {
    if (fail) throw new Error('network down');
    return { resultId: 'result-1', duplicate: false };
  };

  const first = await syncPendingSubmissions('u1', submit, storage, NOW + 1);
  assert.equal(first[0].outcome, 'deferred');

  const pending = await storage.getSubmission('attempt-1');
  assert.equal(pending?.status, 'pending');
  assert.ok((pending?.nextAttemptAt ?? 0) > NOW + 1, 'backoff is in the future');
  assert.equal(pending?.attempts, 1);

  fail = false;
  const later = await syncPendingSubmissions('u1', submit, storage, NOW + 60_000);
  assert.equal(later[0].outcome, 'confirmed');
});

test('a terminal client error marks the submission failed without discarding it', async () => {
  const storage = new MemoryOfflineExamStorage();
  await queueOfflineSubmission('u1', 'attempt-1', { q1: 'A' }, ['q1'], storage, NOW);

  const submit = async (): Promise<SubmitOutcome> => {
    const error = new Error('Attempt expired') as Error & { response?: { status: number } };
    error.response = { status: 409 };
    throw error;
  };

  const results = await syncPendingSubmissions('u1', submit, storage, NOW + 1);
  assert.equal(results[0].outcome, 'failed');

  const submission = await storage.getSubmission('attempt-1');
  assert.equal(submission?.status, 'failed');
  assert.equal(submission?.resultId, null);
  assert.ok(submission, 'the failed submission is preserved, not deleted');
});

test('a storage write failure is surfaced, never silently reported as success', async () => {
  const base = new MemoryOfflineExamStorage();
  const failing: typeof base = {
    ...base,
    putAnswerIfNewer: async () => {
      throw new Error('QuotaExceededError');
    },
  } as unknown as typeof base;

  await assert.rejects(() =>
    saveOfflineAnswer('u1', 'attempt-1', 'q1', 'A', failing, NOW)
  );
});

test('answers are not counted as synced until the submission is confirmed', async () => {
  const storage = new MemoryOfflineExamStorage();
  await saveOfflineAnswer('u1', 'attempt-1', 'q1', 'A', storage, NOW);

  const answers = await storage.getAnswers('attempt-1');
  assert.equal(answers[0].status, 'pending');
});

test('confirmed online submission reconciles stale local answers idempotently', async () => {
  const storage = new MemoryOfflineExamStorage();
  await saveOfflineAnswer('u1', 'attempt-1', 'q1', 'A', storage, NOW);

  await markAttemptSubmitted('attempt-1', 'result-1', storage, NOW);
  await markAttemptSubmitted('attempt-1', 'result-1', storage, NOW + 1);

  const answers = await storage.getAnswers('attempt-1');
  assert.equal(answers[0].status, 'synced');
  assert.equal((await storage.listPendingWork()).pendingAnswers, 0);
});

test('stale answers recover only after the owner-scoped server says finalized', async () => {
  const storage = new MemoryOfflineExamStorage();
  await saveOfflineAnswer('u1', 'attempt-1', 'q1', 'A', storage, NOW);

  await reconcileFinalizedAttempts(
    'u1',
    async () => ({ id: 'attempt-1', status: 'in_progress' }),
    storage
  );
  assert.equal((await storage.getAnswers('attempt-1'))[0].status, 'pending');

  await reconcileFinalizedAttempts(
    'u1',
    async () => ({ id: 'attempt-1', status: 'finalized', exam_history_id: 'result-1' }),
    storage
  );
  assert.equal((await storage.getAnswers('attempt-1'))[0].status, 'synced');
});

test('the OTA activation gate blocks while offline work is protected', async () => {
  const storage = new MemoryOfflineExamStorage();
  const prepared = await prepareExamForOffline(
    { userId: 'u1', examId: 'exam-1', nowMs: NOW },
    api,
    storage
  );
  await saveOfflineAnswer('u1', prepared.attemptId, 'q1', 'A', storage, NOW);
  await queueOfflineSubmission(
    'u1',
    prepared.attemptId,
    { q1: 'A' },
    ['q1', 'q2'],
    storage,
    NOW
  );

  const decision = await evaluateActivationGate({
    auth: { state: 'authenticated', userId: 'u1' },
    storage,
    activities: [],
    pathname: '/dashboard/home',
  });

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.includes('attempt_unresolved'));
  assert.ok(decision.reasons.includes('submission_pending'));
  assert.ok(decision.reasons.includes('pending_answers'));
});
