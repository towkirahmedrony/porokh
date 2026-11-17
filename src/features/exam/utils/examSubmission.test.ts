import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSubmissionStorageKey,
  buildSubmitPayload,
  clearSubmissionId,
  extractSubmittedResultId,
  getOrCreateSubmissionId,
  MalformedSubmitResponseError,
  resolveSubmitErrorMessage,
} from './examSubmission.ts';

/**
 * Contract tests for the examination submission flow.
 *
 * The repository has no component test runner, so the submission contract is
 * covered here at the unit level (payload shape, response validation, error
 * mapping, idempotency key lifecycle). See the report for the behavioural
 * checks that require a browser.
 */

const createMemoryStorage = (): Storage => {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => (values.has(key) ? values.get(key)! : null),
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  } as Storage;
};

const answers = {
  'question-1': 'option-b',
  'question-2': 'option-c',
};

test('payload carries the attempt identifiers, answers and question set', () => {
  const payload = buildSubmitPayload({
    examId: 'exam-1',
    attemptId: 'attempt-1',
    sessionId: 'submission-key-123',
    answers,
    questionIds: ['question-1', 'question-2'],
    timeTaken: 91.6,
  });

  assert.deepEqual(payload.answers, answers);
  assert.equal(payload.exam_id, 'exam-1');
  assert.equal(payload.attempt_id, 'attempt-1');
  assert.equal(payload.session_id, 'submission-key-123');
  assert.deepEqual(payload.question_ids, ['question-1', 'question-2']);
  assert.equal(payload.time_taken, 92);
});

test('payload copies answers so later state changes cannot mutate a retry', () => {
  const live = { ...answers };
  const payload = buildSubmitPayload({
    answers: live,
    questionIds: ['question-1'],
    timeTaken: 10,
  });

  live['question-1'] = 'option-z';

  assert.equal(payload.answers['question-1'], 'option-b');
});

test('payload omits optional identifiers instead of sending null', () => {
  const payload = buildSubmitPayload({
    examId: null,
    attemptId: '   ',
    sessionId: '   ',
    answers,
    questionIds: ['question-1'],
    timeTaken: -5,
  });

  assert.equal('exam_id' in payload, false);
  assert.equal('attempt_id' in payload, false);
  assert.equal('session_id' in payload, false);
  assert.equal(payload.time_taken, 0);
});

test('a wrapped API response yields the persisted result id', () => {
  const id = '9a0d5f4e-1111-4222-8333-444455556666';

  assert.equal(
    extractSubmittedResultId({ success: true, message: 'Exam submitted', data: { id } }),
    id
  );
  // Forward compatible: a bare result object is also accepted.
  assert.equal(extractSubmittedResultId({ id }), id);
});

test('a response without a result id is rejected rather than navigated to', () => {
  assert.throws(() => extractSubmittedResultId({ success: true, data: {} }), MalformedSubmitResponseError);
  assert.throws(() => extractSubmittedResultId({ success: true, data: { id: '   ' } }), MalformedSubmitResponseError);
  assert.throws(() => extractSubmittedResultId(undefined), MalformedSubmitResponseError);
});

test('client errors surface the actionable server message', () => {
  const message = resolveSubmitErrorMessage(
    { response: { status: 409, data: { message: 'An exam attempt must be started before submitting' } } },
    { generic: 'generic', network: 'network' }
  );

  assert.equal(message, 'An exam attempt must be started before submitting');
});

test('server errors and transport failures fall back to localised copy', () => {
  const messages = { generic: 'generic', network: 'network' };

  assert.equal(resolveSubmitErrorMessage({ response: { status: 500, data: {} } }, messages), 'generic');
  assert.equal(resolveSubmitErrorMessage({ response: { status: 503, data: { message: 'SQL detail' } } }, messages), 'generic');
  assert.equal(resolveSubmitErrorMessage({ code: 'ERR_NETWORK' }, messages), 'network');
  assert.equal(resolveSubmitErrorMessage(new Error('boom'), messages), 'network');
});

test('the submission id is stable for a session and cleared after success', () => {
  const storage = createMemoryStorage();
  const key = buildSubmissionStorageKey('biology-10-20');

  const first = getOrCreateSubmissionId(key, storage);
  const second = getOrCreateSubmissionId(key, storage);

  assert.equal(first, second);
  assert.match(first, /^[A-Za-z0-9_-]{8,128}$/);

  clearSubmissionId(key, storage);

  assert.notEqual(getOrCreateSubmissionId(key, storage), first);
});

test('an unusable stored value is replaced instead of being submitted', () => {
  const storage = createMemoryStorage();
  const key = buildSubmissionStorageKey('physics-10-20');

  storage.setItem(key, 'not valid: key');

  const generated = getOrCreateSubmissionId(key, storage);

  assert.match(generated, /^[A-Za-z0-9_-]{8,128}$/);
  assert.equal(storage.getItem(key), generated);
});
