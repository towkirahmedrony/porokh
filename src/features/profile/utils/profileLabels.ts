import { localizeDigits, type AppLanguage, type AppMessageKey } from '@/shared/i18n/messages';
import {
  ADMISSION_TARGET_OPTIONS,
  HSC_GROUP_OPTIONS,
  type AdmissionTarget,
} from './academicProfile';

const BOARD_LABELS_BN: Record<string, string> = {
  Dhaka: 'ঢাকা',
  Rajshahi: 'রাজশাহী',
  Cumilla: 'কুমিল্লা',
  Jashore: 'যশোর',
  Chattogram: 'চট্টগ্রাম',
  Barishal: 'বরিশাল',
  Sylhet: 'সিলেট',
  Dinajpur: 'দিনাজপুর',
  Mymensingh: 'ময়মনসিংহ',
};

const GROUP_LABELS_BN: Record<string, string> = {
  Science: 'বিজ্ঞান',
  Commerce: 'ব্যবসায় শিক্ষা',
  Arts: 'মানবিক',
  // Keep rows written before the onboarding flow readable.
  Business: 'ব্যবসায় শিক্ষা',
  Humanities: 'মানবিক',
};

export const localizeEducationBoard = (
  board: string,
  language: AppLanguage
): string =>
  language === 'bn' ? BOARD_LABELS_BN[board] ?? board : board;

export const localizeAcademicGroup = (
  group: string,
  language: AppLanguage
): string =>
  language === 'bn' ? GROUP_LABELS_BN[group] ?? group : group;

export const localizeClassLevel = (
  level: string,
  language: AppLanguage
): string =>
  language === 'bn'
    ? localizeDigits(level.replace(/HSC/g, 'এইচএসসি'), language)
    : level;

const HSC_GROUP_LABEL_KEYS: Record<string, AppMessageKey> = Object.fromEntries(
  HSC_GROUP_OPTIONS.map((option) => [option.value, option.labelKey])
);

const ADMISSION_TARGET_LABEL_KEYS: Record<string, AppMessageKey> =
  Object.fromEntries(
    ADMISSION_TARGET_OPTIONS.map((option) => [option.value, option.labelKey])
  );

export const localizeHscGroup = (
  group: string,
  t: (key: AppMessageKey) => string
): string => {
  const key = HSC_GROUP_LABEL_KEYS[group];
  return key ? t(key) : group;
};

export const localizeAdmissionTarget = (
  target: string,
  t: (key: AppMessageKey) => string
): string => {
  const key = ADMISSION_TARGET_LABEL_KEYS[target];
  return key ? t(key) : target;
};

export const localizeAdmissionTargets = (
  targets: readonly AdmissionTarget[],
  t: (key: AppMessageKey) => string
): string => targets.map((target) => localizeAdmissionTarget(target, t)).join(', ');
