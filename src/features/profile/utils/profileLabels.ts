import { localizeDigits, type AppLanguage } from '@/shared/i18n/messages';

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
