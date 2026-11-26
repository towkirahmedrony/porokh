import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseStageResponse,
  readCachedStageState,
  stageResponseFromState,
  stageStateFromResponse,
} from './stage';

const valid = {
  stage: 'post_hsc',
  batch_year: '2026',
  goal: null,
  needs_goal_gate: true,
  exam_ended: true,
};

test('a complete stage answer parses', () => {
  assert.deepEqual(parseStageResponse(valid), valid);
});

test('an unknown stage or a missing gate flag is rejected, never defaulted', () => {
  assert.equal(parseStageResponse({ ...valid, stage: 'graduate' }), null);
  assert.equal(parseStageResponse({ ...valid, needs_goal_gate: undefined }), null);
  assert.equal(parseStageResponse({ ...valid, needs_goal_gate: 'yes' }), null);
  assert.equal(parseStageResponse({ ...valid, exam_ended: 1 }), null);
  assert.equal(parseStageResponse({ ...valid, goal: 'doctor' }), null);
  assert.equal(parseStageResponse({ ...valid, batch_year: 2026 }), null);
  assert.equal(parseStageResponse(null), null);
  assert.equal(parseStageResponse([]), null);
});

test('the server answer maps to the state the app reads', () => {
  assert.deepEqual(stageStateFromResponse(parseStageResponse(valid)!), {
    stage: 'post_hsc',
    batchYear: '2026',
    goal: null,
    needsGoalGate: true,
    examEnded: true,
    status: 'ready',
  });
});

test('state and response round-trip for the cache', () => {
  const state = stageStateFromResponse(parseStageResponse(valid)!);
  assert.deepEqual(stageResponseFromState(state), valid);
  assert.deepEqual(readCachedStageState(valid), state);
});

test('an unusable cache entry yields nothing instead of a half state', () => {
  assert.equal(readCachedStageState({ stage: 'post_hsc' }), null);
  assert.equal(readCachedStageState('post_hsc'), null);
  assert.equal(readCachedStageState(null), null);
});
