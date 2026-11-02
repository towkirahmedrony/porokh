import { normalizeUsername } from '@/features/auth/utils/username';
import type { AppMessageKey } from '@/shared/i18n/messages';

export const ONBOARDING_STEPS = [1, 2] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export type OnboardingDraft = {
  step: OnboardingStep;
  fullName: string;
  username: string;
  classLevel: string;
  group: string;
  studyGoal: string;
};

export type CompleteOnboardingParams = {
  p_full_name: string;
  p_username: string;
  p_class_level: string | null;
  p_group: string | null;
  p_study_goal: string | null;
};

export const EMPTY_ONBOARDING_DRAFT: OnboardingDraft = {
  step: 1,
  fullName: '',
  username: '',
  classLevel: '',
  group: '',
  studyGoal: '',
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
  if (message.includes('not authenticated')) {
    return 'onboarding.sessionExpired';
  }
  if (message.includes('duplicate key') || message.includes('profiles_username_key')) {
    return 'onboarding.usernameTaken';
  }

  return 'onboarding.saveFailed';
};
