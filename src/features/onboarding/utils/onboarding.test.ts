import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCompleteOnboardingParams,
  buildOnboardingDraft,
  mapCompleteOnboardingError,
  normalizeFullName,
} from './onboarding';

const draft = {
  step: 2 as const,
  fullName: '  Towkir   Ahmed ',
  username: ' Towkir_7 ',
  studyGoal: 'engineering',
  hscBatch: '2026',
  hscGroup: 'science' as const,
  admissionTargets: ['engineering' as const],
  otherAdmissionTarget: '',
};

test('the payload normalizes the name, the username and the batch', () => {
  assert.equal(normalizeFullName(draft.fullName), 'Towkir Ahmed');
  assert.deepEqual(buildCompleteOnboardingParams(draft), {
    p_full_name: 'Towkir Ahmed',
    p_username: 'towkir_7',
    p_study_goal: 'engineering',
    p_hsc_batch: '2026',
    p_hsc_group: 'science',
    p_admission_targets: ['engineering'],
    p_other_admission_target: null,
  });
});

test('an undecided goal is stored as the hsc track, never as null', () => {
  for (const studyGoal of ['', 'something-else']) {
    assert.equal(
      buildCompleteOnboardingParams({ ...draft, studyGoal }).p_study_goal,
      'hsc'
    );
  }
});

test('class_level and the old group are no longer sent at all', () => {
  const params = buildCompleteOnboardingParams(draft);

  assert.equal('p_class_level' in params, false);
  assert.equal('p_group' in params, false);
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

const profileDefaults = {
  fullName: 'Towkir Ahmed',
  username: 'towkir',
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
    studyGoal: 'engineering',
    hscBatch: '2026',
    hscGroup: 'science',
    admissionTargets: ['medical'],
    otherAdmissionTarget: '',
  });
});

test('RPC exceptions map to friendly onboarding messages', () => {
  assert.equal(mapCompleteOnboardingError(new Error('username unavailable')), 'onboarding.usernameTaken');
  assert.equal(mapCompleteOnboardingError(new Error('invalid name')), 'onboarding.nameInvalid');
  assert.equal(mapCompleteOnboardingError(new Error('invalid goal')), 'onboarding.goalInvalid');
  assert.equal(mapCompleteOnboardingError(new Error('not authenticated')), 'onboarding.sessionExpired');
  assert.equal(mapCompleteOnboardingError(new Error('boom')), 'onboarding.saveFailed');
});
