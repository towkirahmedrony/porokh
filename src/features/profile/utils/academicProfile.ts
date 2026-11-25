import type { AppMessageKey } from '@/shared/i18n/messages';

/**
 * Academic profile vocabulary shared by registration/onboarding and the
 * "complete it later" page.
 *
 * Batch options are code, not free text: they are the single list the new-user
 * form renders, so adding next year's batch is a one-line change here (plus the
 * matching DB constraint if the accepted set ever needs narrowing).
 */
export const HSC_BATCH_OPTIONS = ['2024', '2025', '2026', '2027', '2028'] as const;

export type HscBatch = (typeof HSC_BATCH_OPTIONS)[number];

export const HSC_GROUP_OPTIONS = [
  { value: 'science', labelKey: 'academic.groupScience' },
  { value: 'humanities', labelKey: 'academic.groupHumanities' },
  { value: 'business_studies', labelKey: 'academic.groupBusinessStudies' },
] as const satisfies ReadonlyArray<{ value: string; labelKey: AppMessageKey }>;

export type HscGroup = (typeof HSC_GROUP_OPTIONS)[number]['value'];

export const ADMISSION_TARGET_OPTIONS = [
  { value: 'university', labelKey: 'academic.targetUniversity' },
  { value: 'engineering', labelKey: 'academic.targetEngineering' },
  { value: 'medical', labelKey: 'academic.targetMedical' },
  { value: 'dental', labelKey: 'academic.targetDental' },
  { value: 'agricultural', labelKey: 'academic.targetAgricultural' },
  { value: 'general_university', labelKey: 'academic.targetGeneralUniversity' },
  { value: 'national_university', labelKey: 'academic.targetNationalUniversity' },
  { value: 'other', labelKey: 'academic.targetOther' },
] as const satisfies ReadonlyArray<{ value: string; labelKey: AppMessageKey }>;

export type AdmissionTarget = (typeof ADMISSION_TARGET_OPTIONS)[number]['value'];

const HSC_BATCHES: readonly string[] = HSC_BATCH_OPTIONS;
const HSC_GROUPS: readonly string[] = HSC_GROUP_OPTIONS.map((option) => option.value);
const ADMISSION_TARGETS: readonly string[] = ADMISSION_TARGET_OPTIONS.map(
  (option) => option.value
);

export const OTHER_ADMISSION_TARGET = 'other';
export const OTHER_ADMISSION_TARGET_MAX_LENGTH = 100;

export interface AcademicProfileValues {
  hscBatch: string;
  hscGroup: string;
  admissionTargets: string[];
  otherAdmissionTarget: string;
}

export interface AcademicProfileRecord {
  hsc_batch?: string | null;
  hsc_group?: string | null;
  admission_targets?: string[] | null;
  other_admission_target?: string | null;
}

export const EMPTY_ACADEMIC_PROFILE: AcademicProfileValues = {
  hscBatch: '',
  hscGroup: '',
  admissionTargets: [],
  otherAdmissionTarget: '',
};

export const isKnownHscBatch = (value: string): boolean =>
  HSC_BATCHES.includes(value);

export const isKnownHscGroup = (value: string): value is HscGroup =>
  HSC_GROUPS.includes(value);

export const isKnownAdmissionTarget = (value: string): value is AdmissionTarget =>
  ADMISSION_TARGETS.includes(value);

/** Keeps only known targets, removes duplicates, and preserves UI order. */
export const normalizeAdmissionTargets = (values: readonly string[]): AdmissionTarget[] =>
  ADMISSION_TARGET_OPTIONS.map((option) => option.value).filter((value) =>
    values.includes(value)
  );

export const hasOtherAdmissionTarget = (targets: readonly string[]): boolean =>
  targets.includes(OTHER_ADMISSION_TARGET);

/**
 * Values from a profile row mapped into form state. Unknown stored values are
 * dropped so a legacy row can never put the picker into an invalid state.
 */
export const academicProfileFromRecord = (
  record: AcademicProfileRecord | null | undefined
): AcademicProfileValues => ({
  hscBatch:
    typeof record?.hsc_batch === 'string' && isKnownHscBatch(record.hsc_batch)
      ? record.hsc_batch
      : '',
  hscGroup:
    typeof record?.hsc_group === 'string' && isKnownHscGroup(record.hsc_group)
      ? record.hsc_group
      : '',
  admissionTargets: normalizeAdmissionTargets(record?.admission_targets ?? []),
  otherAdmissionTarget:
    typeof record?.other_admission_target === 'string'
      ? record.other_admission_target
      : '',
});

export type AcademicProfileValidationError =
  | 'academic.batchRequired'
  | 'academic.groupRequired'
  | 'academic.targetsRequired'
  | 'academic.otherTooLong';

export const validateAcademicProfile = (
  values: AcademicProfileValues
): AcademicProfileValidationError | null => {
  if (!isKnownHscBatch(values.hscBatch)) return 'academic.batchRequired';
  if (!isKnownHscGroup(values.hscGroup)) return 'academic.groupRequired';

  const targets = normalizeAdmissionTargets(values.admissionTargets);
  if (targets.length === 0) return 'academic.targetsRequired';

  if (
    hasOtherAdmissionTarget(targets) &&
    values.otherAdmissionTarget.trim().length > OTHER_ADMISSION_TARGET_MAX_LENGTH
  ) {
    return 'academic.otherTooLong';
  }

  return null;
};

export const isAcademicProfileComplete = (
  record: AcademicProfileRecord | null | undefined
): boolean => {
  const values = academicProfileFromRecord(record);
  return validateAcademicProfile(values) === null;
};

export interface AcademicProfileRpcParams {
  p_hsc_batch: string;
  p_hsc_group: string;
  p_admission_targets: string[];
  p_other_admission_target: string | null;
}

/** RPC payload shared by registration onboarding and the later edit page. */
export const buildAcademicProfileRpcParams = (
  values: AcademicProfileValues
): AcademicProfileRpcParams => {
  const targets = normalizeAdmissionTargets(values.admissionTargets);
  const other = values.otherAdmissionTarget.trim();

  return {
    p_hsc_batch: values.hscBatch,
    p_hsc_group: values.hscGroup,
    p_admission_targets: targets,
    p_other_admission_target:
      hasOtherAdmissionTarget(targets) && other ? other : null,
  };
};
