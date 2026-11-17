import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_REVEAL_STATE,
  isExplanationExpanded,
  revealReducer,
  type QuestionBankRevealState,
} from './answerVisibility';

const revealed = (): QuestionBankRevealState =>
  revealReducer(INITIAL_REVEAL_STATE, { type: 'toggle-answers' });

test('answers and explanations start hidden', () => {
  assert.equal(INITIAL_REVEAL_STATE.answersRevealed, false);
  assert.equal(isExplanationExpanded('q1', INITIAL_REVEAL_STATE), false);
});

test('the floating toggle reveals all answers without opening explanations', () => {
  const current = revealed();

  assert.equal(current.answersRevealed, true);
  assert.equal(isExplanationExpanded('q1', current), false);
  assert.equal(isExplanationExpanded('q2', current), false);
});

test('explanations toggle independently while answers are revealed', () => {
  let current = revealed();

  current = revealReducer(current, { type: 'toggle-explanation', questionId: 'q1' });
  assert.equal(isExplanationExpanded('q1', current), true);
  assert.equal(isExplanationExpanded('q2', current), false);

  current = revealReducer(current, { type: 'toggle-explanation', questionId: 'q1' });
  assert.equal(isExplanationExpanded('q1', current), false);
});

test('explanations cannot open while answers are hidden', () => {
  const current = revealReducer(INITIAL_REVEAL_STATE, {
    type: 'toggle-explanation',
    questionId: 'q1',
  });

  assert.equal(current, INITIAL_REVEAL_STATE);
  assert.equal(isExplanationExpanded('q1', current), false);
});

test('hiding answers collapses every explanation', () => {
  let current = revealed();
  current = revealReducer(current, { type: 'toggle-explanation', questionId: 'q1' });
  current = revealReducer(current, { type: 'toggle-explanation', questionId: 'q2' });
  current = revealReducer(current, { type: 'toggle-answers' });

  assert.equal(current.answersRevealed, false);
  assert.equal(isExplanationExpanded('q1', current), false);
  assert.equal(isExplanationExpanded('q2', current), false);
});

test('new questions follow the answer state but stay collapsed', () => {
  const current = revealed();

  assert.equal(current.answersRevealed, true);
  assert.equal(isExplanationExpanded('new-question', current), false);
});

test('reset restores the clean initial state without mutating it', () => {
  let current = revealed();
  current = revealReducer(current, { type: 'toggle-explanation', questionId: 'q1' });
  current = revealReducer(current, { type: 'reset' });

  assert.equal(current.answersRevealed, false);
  assert.equal(isExplanationExpanded('q1', current), false);
  assert.equal(INITIAL_REVEAL_STATE.expandedExplanationIds.size, 0);
});
