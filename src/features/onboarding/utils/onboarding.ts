import { normalizeUsername } from '@/features/auth/utils/username';
import {
  buildAcademicProfileRpcParams,
  normalizeAdmissionTargets,
  type AdmissionTarget,
} from '@/features/profile/utils/academicProfile';
import type { AppMessageKey } from '@/shared/i18n/messages';

export const ONBOARDING_STEPS = [1, 2, 3] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export type OnboardingDraft = {
  step: OnboardingStep;
  fullName: string;
  username: string;
  classLevel: string;
  group: string;
  studyGoal: string;
  hscBatch: string;
  hscGroup: string;
  admissionTargets: AdmissionTarget[];
  otherAdmissionTarget: string;
};

export type CompleteOnboardingParams = {
  p_full_name: string;
  p_username: string;
  p_class_level: string | null;
  p_group: string | null;
  p_study_goal: string | null;
  p_hsc_batch: string;
  p_hsc_group: string;
  p_admission_targets: string[];
  p_other_admission_target: string | null;
};

export const EMPTY_ONBOARDING_DRAFT: OnboardingDraft = {
  step: 1,
  fullName: '',
  username: '',
  classLevel: '',
  group: '',
  studyGoal: '',
  hscBatch: '',
  hscGroup: '',
  admissionTargets: [],
  otherAdmissionTarget: '',
};

export const normalizeFullName = (value: string): string =>
  value.trim().replace(/\s+/g, ' ');

/** Only HSC-level classes have a group; other levels hide the chips. */
export const classLevelNeedsGroup = (classLevel: string): boolean =>
  /^hsc\b/i.test(classLevel.trim());

export type OnboardingProfileDefaults = {
  fullName: string;
  username: string;
  classLevel: string;
  group: string;
  studyGoal: string;
  hscBatch: string;
  hscGroup: string;
  admissionTargets: string[];
  otherAdmissionTarget: string;
};

/**
 * Draft values win because they hold what the user typed last; fields the
 * draft never had are filled from the existing profile row. Without this a
 * user who once had a profile (e.g. flagged incomplete) retypes their name.
 */
export const buildOnboardingDraft = (
  saved: OnboardingDraft | null,
  profile: OnboardingProfileDefaults
): OnboardingDraft => {
  if (!saved) {
    return {
      ...EMPTY_ONBOARDING_DRAFT,
      ...profile,
      admissionTargets: normalizeAdmissionTargets(profile.admissionTargets),
      group: classLevelNeedsGroup(profile.classLevel) ? profile.group : '',
    };
  }

  const merged: OnboardingDraft = {
    ...saved,
    fullName: saved.fullName || profile.fullName,
    username: saved.username || profile.username,
    classLevel: saved.classLevel || profile.classLevel,
    group: saved.group || profile.group,
    studyGoal: saved.studyGoal || profile.studyGoal,
    hscBatch: saved.hscBatch || profile.hscBatch,
    hscGroup: saved.hscGroup || profile.hscGroup,
    admissionTargets:
      saved.admissionTargets.length > 0
        ? normalizeAdmissionTargets(saved.admissionTargets)
        : normalizeAdmissionTargets(profile.admissionTargets),
    otherAdmissionTarget:
      saved.otherAdmissionTarget || profile.otherAdmissionTarget,
  };

  return {
    ...merged,
    group: classLevelNeedsGroup(merged.classLevel) ? merged.group : '',
  };
};

export const buildCompleteOnboardingParams = (
  draft: OnboardingDraft,
  skipStepTwo = false
): CompleteOnboardingParams => ({
  p_full_name: normalizeFullName(draft.fullName),
  p_username: normalizeUsername(draft.username),
  p_class_level: skipStepTwo ? null : draft.classLevel || null,
  p_group:
    skipStepTwo || !classLevelNeedsGroup(draft.classLevel)
      ? null
      : draft.group || null,
  p_study_goal: skipStepTwo ? null : draft.studyGoal || null,
  ...buildAcademicProfileRpcParams({
    hscBatch: draft.hscBatch,
    hscGroup: draft.hscGroup,
    admissionTargets: draft.admissionTargets,
    otherAdmissionTarget: draft.otherAdmissionTarget,
  }),
});

export const mapCompleteOnboardingError = (error: unknown): AppMessageKey => {
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  if (message.includes('username unavailable')) {
    return 'onboarding.usernameTaken';
  }
  if (message.includes('invalid name')) {
    return 'onboarding.nameInvalid';
  }
  if (message.includes('invalid goal')) {
    return 'onboarding.goalInvalid';
  }
  if (message.includes('invalid hsc batch')) {
    return 'academic.batchRequired';
  }
  if (message.includes('invalid hsc group')) {
    return 'academic.groupRequired';
  }
  if (message.includes('invalid admission target')) {
    return 'academic.targetsRequired';
  }
  if (message.includes('invalid other admission target')) {
    return 'academic.otherTooLong';
  }
  if (message.includes('not authenticated')) {
    return 'onboarding.sessionExpired';
  }
  if (message.includes('duplicate key') || message.includes('profiles_username_key')) {
    return 'onboarding.usernameTaken';
  }

  return 'onboarding.saveFailed';
};
