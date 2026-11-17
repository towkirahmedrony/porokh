import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesHomeGridTargetRules } from './homeGridTargeting';

test('empty or non-object rules are shown to everyone', () => {
  assert.equal(matchesHomeGridTargetRules(null, {}), true);
  assert.equal(matchesHomeGridTargetRules({}, {}), true);
  assert.equal(matchesHomeGridTargetRules('bad-value', {}), true);
});

test('a matching study goal is visible and a mismatch is hidden', () => {
  const rules = { study_goal: ['hsc', 'medical'] };

  assert.equal(matchesHomeGridTargetRules(rules, { studyGoal: 'medical' }), true);
  assert.equal(matchesHomeGridTargetRules(rules, { studyGoal: 'engineering' }), false);
});

test('a profile without onboarding fields only sees cards without rules', () => {
  assert.equal(matchesHomeGridTargetRules({ class_level: ['HSC 26'] }, {}), false);
  assert.equal(matchesHomeGridTargetRules({ study_goal: ['hsc'] }, { studyGoal: null }), false);
  assert.equal(matchesHomeGridTargetRules({}, {}), true);
});

test('class level and group use the same list matching', () => {
  assert.equal(
    matchesHomeGridTargetRules(
      { class_level: ['HSC 26'], group: ['Science'] },
      { classLevel: 'HSC 26', group: 'Science' }
    ),
    true
  );
  assert.equal(
    matchesHomeGridTargetRules({ group: ['Commerce'] }, { group: 'Science' }),
    false
  );
});

test('the all sentinel disables that specific rule', () => {
  assert.equal(
    matchesHomeGridTargetRules({ class_level: ['all'], group: ['Arts'] }, { classLevel: 'HSC 25' }),
    false
  );
  assert.equal(matchesHomeGridTargetRules({ class_level: ['all'] }, {}), true);
});

test('legacy single strings, case differences and unknown banner keys are tolerated', () => {
  assert.equal(
    matchesHomeGridTargetRules(
      { class_level: 'HSC 26', description_bn: 'বিস্তারিত' },
      { classLevel: ' hsc 26 ' }
    ),
    true
  );
  assert.equal(
    matchesHomeGridTargetRules({ class_levels: ['HSC 24'] }, { classLevel: 'hsc 24' }),
    true
  );
});
