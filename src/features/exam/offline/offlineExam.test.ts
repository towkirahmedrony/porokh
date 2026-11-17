import test from 'node:test';
import assert from 'node:assert/strict';

import { MemoryOfflineExamStorage } from './storage.ts';
import type {
  AnswerRecord,
  ExamAttemptRecord,
  SubmissionRecord,
} from './types.ts';

const attempt = (overrides: Partial<ExamAttemptRecord> = {}): ExamAttemptRecord => ({
  key: 'practice:e1',
  userId: 'u1',
  scope: 'practice',
  attemptId: 'a1',
  examId: 'e1',
  status: 'in_progress',
  offlinePolicy: 'offline_allowed',
  startedAt: 1_700_000_000_000,
  deadlineAt: null,
  serverTimeAtSync: null,
  clientTimeAtSync: null,
  wallHighWaterMs: null,
  secondsRemainingAtSync: null,
  durationSeconds: 600,
  questionIds: ['q1', 'q2'],
  questionsVersion: 'v1',
  prepared: true,
  currentIndex: 0,
  lastServerUpdatedAt: null,
  lastSyncedAt: null,
  lastSyncError: null,
  syncAttempts: 0,
  nextSyncAt: null,
  submissionId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const submission = (
  overrides: Partial<SubmissionRecord> = {}
): SubmissionRecord => ({
  attemptId: 'a1',
  userId: 'u1',
  status: 'pending',
  idempotencyKey: 'key-1',
  payload: { answers: { q1: 'A' } },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  attempts: 1,
  lastAttemptAt: null,
  lastError: null,
  resultId: null,
  result: null,
  ...overrides,
});

const answer = (overrides: Partial<AnswerRecord> = {}): AnswerRecord => ({
  id: 'a1:q1',
  attemptId: 'a1',
  userId: 'u1',
  questionId: 'q1',
  value: 'A',
  revision: 1,
  operationId: 'op-1',
  updatedAt: '2026-01-01T00:00:00.000Z',
  status: 'pending',
  lastError: null,
  ...overrides,
});

test('init resolves without error', async () => {
  const storage = new MemoryOfflineExamStorage();
  await assert.doesNotReject(() => storage.init());
});

test('putAttempt stores and getAttempt returns the record', async () => {
  const storage = new MemoryOfflineExamStorage();
  await storage.putAttempt(attempt());

  const record = await storage.getAttempt('a1');
  assert.equal(record?.attemptId, 'a1');
  assert.equal(record?.examId, 'e1');
});

test('getAttempt returns null for an unknown attempt', async () => {
  const storage = new MemoryOfflineExamStorage();
  assert.equal(await storage.getAttempt('missing'), null);
});

test('listAttemptsForUser scopes results to the owning user', async () => {
  const storage = new MemoryOfflineExamStorage();
  await storage.putAttempt(attempt({ attemptId: 'a1', userId: 'u1' }));
  await storage.putAttempt(attempt({ attemptId: 'a2', userId: 'u2' }));

  const mine = await storage.listAttemptsForUser('u1');
  assert.deepEqual(
    mine.map((item) => item.attemptId),
    ['a1']
  );

  const theirs = await storage.listAttemptsForUser('u2');
  assert.deepEqual(
    theirs.map((item) => item.attemptId),
    ['a2']
  );
});

test('putSubmission and getSubmission round-trip', async () => {
  const storage = new MemoryOfflineExamStorage();
  await storage.putSubmission(submission({ status: 'confirmed' }));

  const record = await storage.getSubmission('a1');
  assert.equal(record?.status, 'confirmed');
  assert.equal(record?.idempotencyKey, 'key-1');
});

test('getSubmission returns null for an unknown attempt', async () => {
  const storage = new MemoryOfflineExamStorage();
  assert.equal(await storage.getSubmission('missing'), null);
});

test('putAnswerIfNewer keeps the newest revision and drops stale replays', async () => {
  const storage = new MemoryOfflineExamStorage();

  await storage.putAnswerIfNewer(answer({ revision: 2, value: 'B' }));
  // A stale replay of an older revision must not overwrite the newer value.
  await storage.putAnswerIfNewer(answer({ revision: 1, value: 'A' }));

  const answers = await storage.getAnswers('a1');
  assert.equal(answers.length, 1);
  assert.equal(answers[0].value, 'B');
  assert.equal(answers[0].revision, 2);
});

test('getAnswers scopes results to the owning attempt', async () => {
  const storage = new MemoryOfflineExamStorage();
  await storage.putAnswerIfNewer(answer({ id: 'a1:q1', attemptId: 'a1' }));
  await storage.putAnswerIfNewer(answer({ id: 'a2:q1', attemptId: 'a2' }));

  const answers = await storage.getAnswers('a1');
  assert.deepEqual(
    answers.map((item) => item.id),
    ['a1:q1']
  );
});

test('removeAttempt clears the attempt, submission and answers', async () => {
  const storage = new MemoryOfflineExamStorage();
  await storage.putAttempt(attempt());
  await storage.putSubmission(submission());
  await storage.putAnswerIfNewer(answer());

  await storage.removeAttempt('a1');

  assert.equal(await storage.getAttempt('a1'), null);
  assert.equal(await storage.getSubmission('a1'), null);
  assert.deepEqual(await storage.getAnswers('a1'), []);
});
