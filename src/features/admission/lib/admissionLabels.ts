import type { AppMessageKey, AppLanguage } from '@/shared/i18n/messages';
import { localizeDigits } from '@/shared/i18n/messages';
import type { AdmissionExamType, AdmissionGroup } from '../types/admission';

type Translator = (key: AppMessageKey, values?: Record<string, string | number>) => string;

const GROUP_KEYS: Record<
  string,
  { name: AppMessageKey; description: AppMessageKey }
> = {
  science: {
    name: 'admission.group.science',
    description: 'admission.group.scienceDescription',
  },
  arts: {
    name: 'admission.group.arts',
    description: 'admission.group.artsDescription',
  },
  commerce: {
    name: 'admission.group.commerce',
    description: 'admission.group.commerceDescription',
  },
};

export const getAdmissionGroupName = (
  group: AdmissionGroup,
  t: Translator,
  language: AppLanguage
): string => {
  const keys = GROUP_KEYS[group.slug];
  if (keys) return t(keys.name);

  if (language === 'bn') return group.nameBn || group.nameEn || group.slug;
  return group.nameEn || group.nameBn || group.slug;
};

export const getAdmissionGroupDescription = (
  group: AdmissionGroup,
  t: Translator,
  language: AppLanguage
): string => {
  const keys = GROUP_KEYS[group.slug];
  if (keys) return t(keys.description);

  if (language === 'bn') {
    return group.descriptionBn ?? group.descriptionEn ?? '';
  }
  return group.descriptionEn ?? group.descriptionBn ?? '';
};

export const getAdmissionExamTypeLabel = (
  examType: AdmissionExamType,
  t: Translator
): string =>
  examType === 'model-test'
    ? t('admission.examType.modelTest')
    : t('admission.examType.pastExams');

export const getAdmissionExamTypeDescription = (
  examType: AdmissionExamType,
  t: Translator
): string =>
  examType === 'model-test'
    ? t('admission.examType.modelTestDescription')
    : t('admission.examType.pastExamsDescription');

export const formatAdmissionCount = (
  count: number,
  language: AppLanguage
): string => localizeDigits(count, language);
