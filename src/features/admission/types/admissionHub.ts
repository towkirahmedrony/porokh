/**
 * Shapes returned by the admission hub RPCs
 * (`get_admission_hub_catalog`, `get_admission_unit_hub`).
 *
 * The functions return jsonb, so every field is validated in
 * `admissionHubService` before it reaches a component. Snake_case names below
 * mirror the wire contract only; mapped camelCase types are what the UI uses.
 */

export interface AdmissionHubUnit {
  id: string;
  nameBn: string;
  nameEn: string | null;
  code: string;
  displayOrder: number | null;
  groupType: string | null;
  pastPaperCount: number;
  modelTestCount: number;
  questionCount: number;
  isAvailable: boolean;
}

export interface AdmissionHubUniversity {
  id: string;
  nameBn: string;
  nameEn: string | null;
  shortName: string | null;
  slug: string;
  logoUrl: string | null;
  location: string | null;
  displayOrder: number | null;
  unitCount: number;
  pastPaperCount: number;
  modelTestCount: number;
  questionCount: number;
  units: AdmissionHubUnit[];
}

export interface AdmissionHubPaper {
  id: string;
  title: string;
  titleEn: string | null;
  category: 'admission' | 'model_test';
  examYearLabel: string | null;
  examSession: string | null;
  durationMin: number | null;
  totalMarks: number | null;
  defaultNegativeMarks: number | null;
  isPremium: boolean;
  startTime: string | null;
  endTime: string | null;
  questionCount: number;
}

export interface AdmissionBankYearFacet {
  label: string;
  count: number;
}

export interface AdmissionBankSubjectFacet {
  id: string;
  nameBn: string;
  nameEn: string | null;
  questionCount: number;
}

export interface AdmissionBankTopicFacet {
  id: string;
  subjectId: string | null;
  chapterId: string | null;
  nameBn: string;
  nameEn: string | null;
  questionCount: number;
}

export interface AdmissionUnitHubData {
  unit: {
    id: string;
    nameBn: string;
    nameEn: string | null;
    code: string;
    description: string | null;
    displayOrder: number | null;
    groupType: string | null;
  };
  university: {
    id: string;
    nameBn: string;
    nameEn: string | null;
    shortName: string | null;
    slug: string;
    logoUrl: string | null;
  };
  pastPapers: AdmissionHubPaper[];
  modelTests: AdmissionHubPaper[];
  bank: {
    total: number;
    years: AdmissionBankYearFacet[];
    subjects: AdmissionBankSubjectFacet[];
    topics: AdmissionBankTopicFacet[];
  };
}

export type AdmissionHubTab = 'papers' | 'models' | 'bank';

export interface AdmissionBankFilters {
  year: string;
  subjectId: string;
  topicId: string;
}

export const EMPTY_ADMISSION_BANK_FILTERS: AdmissionBankFilters = {
  year: '',
  subjectId: '',
  topicId: '',
};
