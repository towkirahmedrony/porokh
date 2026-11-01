import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCompleteOnboardingParams,
  classLevelNeedsGroup,
  mapCompleteOnboardingError,
  normalizeFullName,
} from './onboarding';

const draft = {
  step: 2 as const,
  fullName: '  Towkir   Ahmed ',
  username: ' Towkir_7 ',
  classLevel: 'HSC 26',
  group: 'Science',
  studyGoal: 'engineering',
};

test('step two saves normalized name, username and the three optional fields', () => {
  assert.equal(normalizeFullName(draft.fullName), 'Towkir Ahmed');
  assert.deepEqual(buildCompleteOnboardingParams(draft), {
    p_full_name: 'Towkir Ahmed',
    p_username: 'towkir_7',
    p_class_level: 'HSC 26',
    p_group: 'Science',
    p_study_goal: 'engineering',
  });
});

test('skipping step two sends nulls for class, group and goal', () => {
  assert.deepEqual(buildCompleteOnboardingParams(draft, true), {
    p_full_name: 'Towkir Ahmed',
    p_username: 'towkir_7',
    p_class_level: null,
    p_group: null,
    p_study_goal: null,
  });
});

test('a group is only saved for HSC-level classes', () => {
  assert.equal(classLevelNeedsGroup('HSC 26'), true);
  assert.equal(classLevelNeedsGroup('Admission'), false);
  assert.equal(
    buildCompleteOnboardingParams({ ...draft, classLevel: 'Admission' }).p_group,
    null
  );
});

test('RPC exceptions map to friendly onboarding messages', () => {
  assert.equal(mapCompleteOnboardingError(new Error('username unavailable')), 'onboarding.usernameTaken');
  assert.equal(mapCompleteOnboardingError(new Error('invalid name')), 'onboarding.nameInvalid');
  assert.equal(mapCompleteOnboardingError(new Error('invalid goal')), 'onboarding.goalInvalid');
  assert.equal(mapCompleteOnboardingError(new Error('not authenticated')), 'onboarding.sessionExpired');
  assert.equal(mapCompleteOnboardingError(new Error('boom')), 'onboarding.saveFailed');
});
