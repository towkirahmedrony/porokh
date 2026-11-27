import assert from 'node:assert/strict';
import { test } from 'node:test';
import { needsGoalEmptyState, resolveBankMode, resolveInitialLevel } from './bankMode';

const ready = { status: 'ready' as const };

test('a student still studying opens on HSC and may switch level', () => {
  assert.deepEqual(resolveBankMode({ ...ready, stage: 'studying', goal: null }), {
    mode: 'hsc',
    canSwitchLevel: true,
    defaultTrack: null,
  });
});

test('a studying student with a goal still opens on HSC but defaults the admission tab', () => {
  const result = resolveBankMode({ ...ready, stage: 'studying', goal: 'medical' });

  assert.equal(result.mode, 'hsc');
  assert.equal(result.canSwitchLevel, true);
  assert.equal(result.defaultTrack, 'medical');
});

test('admission prep hides HSC completely and offers no switch', () => {
  const result = resolveBankMode({ ...ready, stage: 'admission_prep', goal: 'varsity' });

  assert.equal(result.mode, 'admission');
  assert.equal(result.canSwitchLevel, false);
  assert.equal(result.defaultTrack, 'varsity');
  assert.equal(resolveInitialLevel(result, 'hsc'), 'admission');
});

test('admission prep without a confirmed goal shows every admission track', () => {
  const result = resolveBankMode({ ...ready, stage: 'admission_prep', goal: null });

  assert.equal(result.mode, 'admission');
  assert.equal(result.defaultTrack, null);
});

test('a goal of hsc is not an admission track', () => {
  const result = resolveBankMode({ ...ready, stage: 'admission_prep', goal: 'hsc' });

  assert.equal(result.defaultTrack, null);
});

test('post_hsc, an unknown stage and a pending load are all neutral', () => {
  for (const stage of ['post_hsc', null] as const) {
    assert.deepEqual(resolveBankMode({ ...ready, stage, goal: 'varsity' }), {
      mode: 'neutral',
      canSwitchLevel: false,
      defaultTrack: null,
    });
  }

  for (const status of ['idle', 'loading', 'error'] as const) {
    assert.equal(
      resolveBankMode({ stage: 'studying', goal: null, status }).mode,
      'neutral'
    );
  }
});

test('a stored tab is only honoured while the student may switch level', () => {
  const studying = resolveBankMode({ ...ready, stage: 'studying', goal: null });
  const admissionPrep = resolveBankMode({ ...ready, stage: 'admission_prep', goal: null });

  assert.equal(resolveInitialLevel(studying, 'admission'), 'admission');
  assert.equal(resolveInitialLevel(studying, 'hsc'), 'hsc');
  assert.equal(resolveInitialLevel(studying, null), 'hsc');
  assert.equal(resolveInitialLevel(admissionPrep, 'hsc'), 'admission');
  assert.equal(resolveInitialLevel(admissionPrep, null), 'admission');
});

test('the goal empty state appears only for a goal track with no questions', () => {
  const engineering = resolveBankMode({ ...ready, stage: 'admission_prep', goal: 'engineering' });

  assert.equal(needsGoalEmptyState(engineering, 'admission', 0, false, true), true);
  // Questions exist, so the normal list renders.
  assert.equal(needsGoalEmptyState(engineering, 'admission', 10, false, true), false);
  // The "all admission" chip is on, so an empty goal is not the reason.
  assert.equal(needsGoalEmptyState(engineering, 'admission', 0, true, true), false);
  // HSC browsing is never a goal empty state.
  assert.equal(needsGoalEmptyState(engineering, 'hsc', 0, false, true), false);

  const noGoal = resolveBankMode({ ...ready, stage: 'admission_prep', goal: null });
  assert.equal(needsGoalEmptyState(noGoal, 'admission', 0, false, true), false);
});

test('a goal empty state waits for a successful response', () => {
  const engineering = resolveBankMode({ ...ready, stage: 'admission_prep', goal: 'engineering' });

  // Loading, an error and a disabled query all look like "0 rows". None of
  // them may claim the track has no questions.
  assert.equal(needsGoalEmptyState(engineering, 'admission', 0, false, false), false);
  assert.equal(needsGoalEmptyState(engineering, 'admission', 0, false, true), true);
});
