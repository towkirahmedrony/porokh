import test from 'node:test';
import assert from 'node:assert/strict';

import { MemoryOfflineExamStorage } from './storage.ts';
import type {
  AnswerRecord,
  ExamAttemptRecord,
  SubmissionRecord,
} from './types.ts';

const attempt = (
  overrides: Partial<ExamAttemptRecord> = {}
): ExamAttemptRecord => ({
  key: 'practice:e1',
  userId: 'u1',
  scope: 'practice',
  attemptId: 'a1',
  examId: 'e1',
  status: 'in_progress',
  offlinePolicy: 'offline_allowed',
  startedAt: null,
  deadlineAt: null,
  serverTimeAtSync: null,
  clientTimeAtSync: null,
  wallHighWaterMs: null,
  secondsRemainingAtSync: null,
  durationSeconds: 600,
  questionIds: ['q1'],
  questionsVersion: null,
  prepared: true,
  currentIndex: 0,
  lastServerUpdatedAt: null,
  lastSyncedAt: null,
  lastSyncError: null,
  syncAttempts: 0,
  nextSyncAt: null,
  submissionId: 's1',
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
  payload: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  attempts: 0,
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

test('an empty store has nothing pending', async () => {
  const storage = new MemoryOfflineExamStorage();
  assert.deepEqual(await storage.listPendingWork(), {
    inProgressAttempts: 0,
    pendingSubmissions: 0,
    pendingAnswers: 0,
  });
});

test('unfinished work is counted regardless of which user owns it', async () => {
  const storage = new MemoryOfflineExamStorage();
  await storage.putAttempt(attempt({ attemptId: 'a1', userId: 'u1' }));
  await storage.putAttempt(
    attempt({ attemptId: 'a2', userId: 'u2', key: 'practice:e2' })
  );
  await storage.putSubmission(submission({ attemptId: 'a1', userId: 'u1' }));
  await storage.putAnswerIfNewer(answer({ id: 'u2:q1', attemptId: 'a2', userId: 'u2' }));

  assert.deepEqual(await storage.listPendingWork(), {
    inProgressAttempts: 2,
    pendingSubmissions: 1,
    pendingAnswers: 1,
  });
});

test('finished work is not counted', async () => {
  const storage = new MemoryOfflineExamStorage();
  await storage.putAttempt(attempt({ status: 'submitted' }));
  await storage.putSubmission(submission({ status: 'confirmed' }));
  await storage.putAnswerIfNewer(answer({ status: 'synced' }));

  assert.deepEqual(await storage.listPendingWork(), {
    inProgressAttempts: 0,
    pendingSubmissions: 0,
    pendingAnswers: 0,
  });
});

test('a failed submission still counts: it has not been delivered', async () => {
  const storage = new MemoryOfflineExamStorage();
  await storage.putSubmission(submission({ status: 'failed' }));

  const pending = await storage.listPendingWork();
  assert.equal(pending.pendingSubmissions, 1);
});
