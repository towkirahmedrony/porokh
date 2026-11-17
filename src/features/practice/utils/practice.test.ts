import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_PRACTICE_QUESTIONS,
  parsePracticeCount,
  sanitizeCountInput,
  normalizeAttemptAnswers,
  findFirstUnansweredQuestionIndex,
  clampQuestionIndex,
} from './practice.ts';

test('practice count accepts only whole numbers between 1 and 100', () => {
  assert.equal(parsePracticeCount(5), 5);
  assert.equal(parsePracticeCount('10'), 10);
  assert.equal(parsePracticeCount(1), 1);
  assert.equal(parsePracticeCount(MAX_PRACTICE_QUESTIONS), MAX_PRACTICE_QUESTIONS);

  assert.equal(parsePracticeCount(0), null);
  assert.equal(parsePracticeCount(-1), null);
  assert.equal(parsePracticeCount(101), null);
  assert.equal(parsePracticeCount(2.5), null);
  assert.equal(parsePracticeCount(''), null);
  assert.equal(parsePracticeCount('abc'), null);
  assert.equal(parsePracticeCount(Number.NaN), null);
});

test('custom count input keeps digits only and never exceeds three characters', () => {
  assert.equal(sanitizeCountInput('12a'), '12');
  assert.equal(sanitizeCountInput('0012'), '001');
  assert.equal(sanitizeCountInput('12345'), '123');
  assert.equal(sanitizeCountInput(''), '');
});

test('attempt drafts are normalized to string option ids and empty answers are dropped', () => {
  assert.deepEqual(
    normalizeAttemptAnswers({
      q1: 'option-1',
      q2: 2,
      q3: null,
      q4: undefined,
      q5: '',
    }),
    { q1: 'option-1', q2: '2' }
  );

  assert.deepEqual(normalizeAttemptAnswers(null), {});
  assert.deepEqual(normalizeAttemptAnswers([1, 2]), {});
  assert.deepEqual(normalizeAttemptAnswers('nope'), {});
});

test('quiz resume lands on the first unanswered question at or after the saved index', () => {
  const questions = [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }, { id: 'q4' }];

  assert.equal(findFirstUnansweredQuestionIndex(questions, {}, 0), 0);
  assert.equal(findFirstUnansweredQuestionIndex(questions, { q1: 'a' }, 0), 1);
  assert.equal(findFirstUnansweredQuestionIndex(questions, { q1: 'a', q2: 'b' }, 0), 2);
  assert.equal(findFirstUnansweredQuestionIndex(questions, {}, 2), 2);
  assert.equal(findFirstUnansweredQuestionIndex(questions, { q1: 'a', q2: 'b', q3: 'c' }, 0), 3);
  assert.equal(
    findFirstUnansweredQuestionIndex(questions, { q1: 'a', q2: 'b', q3: 'c', q4: 'd' }, 0),
    null
  );
});

test('quiz resume wraps around only when the tail has no unanswered question', () => {
  const questions = [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }];

  assert.equal(
    findFirstUnansweredQuestionIndex(questions, { q2: 'b', q3: 'c' }, 2),
    0
  );
  assert.equal(
    findFirstUnansweredQuestionIndex(questions, { q2: 'b', q3: 'c' }, 1),
    0
  );
});

test('quiz navigation clamps indexes to the available question set', () => {
  assert.equal(clampQuestionIndex(-5, 3), 0);
  assert.equal(clampQuestionIndex(0, 3), 0);
  assert.equal(clampQuestionIndex(2, 3), 2);
  assert.equal(clampQuestionIndex(9, 3), 2);
  assert.equal(clampQuestionIndex(4, 0), 0);
  assert.equal(clampQuestionIndex(Number.NaN, 3), 0);
});
