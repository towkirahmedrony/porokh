import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_EXPLANATION_VISIBILITY,
  isExplanationVisible,
  toggleExplanationVisibility,
} from './explanationVisibility';

test('explanations are hidden by default', () => {
  assert.equal(isExplanationVisible('q1', EMPTY_EXPLANATION_VISIBILITY), false);
});

test('each explanation toggles independently by question id', () => {
  let current = toggleExplanationVisibility(EMPTY_EXPLANATION_VISIBILITY, 'q1');

  assert.equal(isExplanationVisible('q1', current), true);
  assert.equal(isExplanationVisible('q2', current), false);

  current = toggleExplanationVisibility(current, 'q1');
  assert.equal(isExplanationVisible('q1', current), false);
});

test('toggling does not mutate the previous state', () => {
  const initial = toggleExplanationVisibility(EMPTY_EXPLANATION_VISIBILITY, 'q1');
  toggleExplanationVisibility(initial, 'q2');

  assert.equal(isExplanationVisible('q1', initial), true);
  assert.equal(isExplanationVisible('q2', initial), false);
  assert.equal(EMPTY_EXPLANATION_VISIBILITY.size, 0);
});

test('same question id keeps its state when the list changes', () => {
  const current = toggleExplanationVisibility(EMPTY_EXPLANATION_VISIBILITY, 'stable-id');

  assert.equal(isExplanationVisible('stable-id', current), true);
  assert.equal(isExplanationVisible('other-id', current), false);
});
