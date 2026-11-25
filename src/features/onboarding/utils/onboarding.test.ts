import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCompleteOnboardingParams,
  buildOnboardingDraft,
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
  hscBatch: '2026',
  hscGroup: 'science' as const,
  admissionTargets: ['engineering' as const],
  otherAdmissionTarget: '',
};

test('step two saves normalized name, username and the three optional fields', () => {
  assert.equal(normalizeFullName(draft.fullName), 'Towkir Ahmed');
  assert.deepEqual(buildCompleteOnboardingParams(draft), {
    p_full_name: 'Towkir Ahmed',
    p_username: 'towkir_7',
    p_class_level: 'HSC 26',
    p_group: 'Science',
    p_study_goal: 'engineering',
    p_hsc_batch: '2026',
    p_hsc_group: 'science',
    p_admission_targets: ['engineering'],
    p_other_admission_target: null,
  });
});

test('skipping step two sends nulls for class, group and goal', () => {
  assert.deepEqual(buildCompleteOnboardingParams(draft, true), {
    p_full_name: 'Towkir Ahmed',
    p_username: 'towkir_7',
    p_class_level: null,
    p_group: null,
    p_study_goal: null,
    p_hsc_batch: '2026',
    p_hsc_group: 'science',
    p_admission_targets: ['engineering'],
    p_other_admission_target: null,
  });
});

test('the other admission target is only saved when Other is selected', () => {
  const withoutOther = buildCompleteOnboardingParams({
    ...draft,
    otherAdmissionTarget: 'Pharmacy',
  });
  assert.equal(withoutOther.p_other_admission_target, null);

  const withOther = buildCompleteOnboardingParams({
    ...draft,
    admissionTargets: ['medical', 'other'],
    otherAdmissionTarget: '  Pharmacy  ',
  });
  assert.deepEqual(withOther.p_admission_targets, ['medical', 'other']);
  assert.equal(withOther.p_other_admission_target, 'Pharmacy');
});

test('a group is only saved for HSC-level classes', () => {
  assert.equal(classLevelNeedsGroup('HSC 26'), true);
  assert.equal(classLevelNeedsGroup('Admission'), false);
  assert.equal(
    buildCompleteOnboardingParams({ ...draft, classLevel: 'Admission' }).p_group,
    null
  );
});

const profileDefaults = {
  fullName: 'Towkir Ahmed',
  username: 'towkir',
  classLevel: 'HSC 26',
  group: 'Science',
  studyGoal: 'medical',
  hscBatch: '2026',
  hscGroup: 'science',
  admissionTargets: ['medical'],
  otherAdmissionTarget: '',
};

test('an existing profile prefills every onboarding field', () => {
  assert.deepEqual(buildOnboardingDraft(null, profileDefaults), {
    step: 1,
    ...profileDefaults,
  });
});

test('a saved draft keeps what the user typed and fills only its gaps', () => {
  const saved = {
    step: 2 as const,
    fullName: '',
    username: 'towkir',
    classLevel: '',
    group: 'Science',
    studyGoal: 'engineering',
    hscBatch: '',
    hscGroup: '',
    admissionTargets: [],
    otherAdmissionTarget: '',
  };

  assert.deepEqual(buildOnboardingDraft(saved, profileDefaults), {
    step: 2,
    fullName: 'Towkir Ahmed',
    username: 'towkir',
    classLevel: 'HSC 26',
    group: 'Science',
    studyGoal: 'engineering',
    hscBatch: '2026',
    hscGroup: 'science',
    admissionTargets: ['medical'],
    otherAdmissionTarget: '',
  });
});

test('a prefilled group is dropped when the level does not use one', () => {
  const prefilled = buildOnboardingDraft(null, {
    ...profileDefaults,
    classLevel: 'Admission',
  });

  assert.equal(prefilled.group, '');
});

test('RPC exceptions map to friendly onboarding messages', () => {
  assert.equal(mapCompleteOnboardingError(new Error('username unavailable')), 'onboarding.usernameTaken');
  assert.equal(mapCompleteOnboardingError(new Error('invalid name')), 'onboarding.nameInvalid');
  assert.equal(mapCompleteOnboardingError(new Error('invalid goal')), 'onboarding.goalInvalid');
  assert.equal(mapCompleteOnboardingError(new Error('not authenticated')), 'onboarding.sessionExpired');
  assert.equal(mapCompleteOnboardingError(new Error('boom')), 'onboarding.saveFailed');
});
