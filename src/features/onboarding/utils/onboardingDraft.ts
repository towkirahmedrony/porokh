import { STORAGE_KEYS } from '@/shared/constants/storageKeys';
import { StorageUtils } from '@/shared/utils/storage';
import {
  EMPTY_ONBOARDING_DRAFT,
  type OnboardingDraft,
} from './onboarding';
import { normalizeAdmissionTargets } from '@/features/profile/utils/academicProfile';

const draftKey = (userId: string) =>
  `${STORAGE_KEYS.SIGNUP_ONBOARDING_DRAFT_PREFIX}${userId}` as const;

const isString = (value: unknown): value is string => typeof value === 'string';

const readDraft = (value: unknown): OnboardingDraft | null => {
  if (!value || typeof value !== 'object') return null;

  const draft = value as Record<string, unknown>;
  if (draft.step !== 1 && draft.step !== 2 && draft.step !== 3) return null;

  return {
    step: draft.step,
    fullName: isString(draft.fullName) ? draft.fullName : '',
    username: isString(draft.username) ? draft.username : '',
    studyGoal: isString(draft.studyGoal) ? draft.studyGoal : '',
    hscBatch: isString(draft.hscBatch) ? draft.hscBatch : '',
    hscGroup: isString(draft.hscGroup) ? draft.hscGroup : '',
    admissionTargets: Array.isArray(draft.admissionTargets)
      ? normalizeAdmissionTargets(draft.admissionTargets.filter(isString))
      : [],
    otherAdmissionTarget: isString(draft.otherAdmissionTarget)
      ? draft.otherAdmissionTarget
      : '',
  };
};

export const loadOnboardingDraft = (userId: string): OnboardingDraft | null =>
  readDraft(StorageUtils.get<unknown>(draftKey(userId)));

export const saveOnboardingDraft = (
  userId: string,
  draft: OnboardingDraft
): void => {
  StorageUtils.set(draftKey(userId), draft);
};

export const clearOnboardingDraft = (userId: string): void => {
  StorageUtils.remove(draftKey(userId));
};

export const createInitialDraft = (
  saved: OnboardingDraft | null
): OnboardingDraft => saved ?? { ...EMPTY_ONBOARDING_DRAFT };
