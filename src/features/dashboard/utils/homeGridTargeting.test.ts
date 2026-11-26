import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesHomeGridTargetRules, normalizeBatchRuleValue } from './homeGridTargeting';

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
  assert.equal(matchesHomeGridTargetRules({ hsc_batch: ['2026'] }, {}), false);
  assert.equal(matchesHomeGridTargetRules({ study_goal: ['hsc'] }, { studyGoal: null }), false);
  assert.equal(matchesHomeGridTargetRules({}, {}), true);
});

test('batch and group use the same list matching', () => {
  assert.equal(
    matchesHomeGridTargetRules(
      { hsc_batch: ['2026'], group: ['Science'] },
      { hscBatch: '2026', group: 'Science' }
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
    matchesHomeGridTargetRules({ hsc_batch: ['all'], group: ['Arts'] }, { hscBatch: '2025' }),
    false
  );
  assert.equal(matchesHomeGridTargetRules({ hsc_batch: ['all'] }, {}), true);
});

test('legacy class rules keep matching the same batch', () => {
  assert.equal(
    matchesHomeGridTargetRules(
      { class_level: 'HSC 26', description_bn: 'বিস্তারিত' },
      { hscBatch: '2026' }
    ),
    true
  );
  assert.equal(
    matchesHomeGridTargetRules({ class_levels: ['HSC 24'] }, { hscBatch: '2024' }),
    true
  );
  assert.equal(
    matchesHomeGridTargetRules({ class_level: ['hsc-25'] }, { hscBatch: '2026' }),
    false
  );
});

test('batch values normalize to a four-digit year', () => {
  assert.equal(normalizeBatchRuleValue('HSC 26'), '2026');
  assert.equal(normalizeBatchRuleValue(' hsc-26 '), '2026');
  assert.equal(normalizeBatchRuleValue('2026'), '2026');
  assert.equal(normalizeBatchRuleValue('all'), 'all');
});
