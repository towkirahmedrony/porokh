/**
 * Admission feature types.
 *
 * These types describe the admission *browsing* domain. Exam execution keeps
 * using the shared exam types (`@/features/exam/types/exam`) and the existing
 * attempt/submission endpoints.
 */

export const ADMISSION_EXAM_TYPES = ['model-test', 'past-exams'] as const;

export type AdmissionExamType = (typeof ADMISSION_EXAM_TYPES)[number];

export type AdmissionExamAvailability =
  | 'available'
  | 'not-started'
  | 'closed'
  | 'unpublished';

export interface AdmissionInstitutionRow {
  id: string;
  name_bn: string;
  name_en: string | null;
  short_name: string | null;
  slug: string | null;
  code: string | null;
  aliases: string[] | null;
  location: string | null;
  district: string | null;
  display_order: number | null;
  type: string;
  is_active: boolean | null;
}

/** Raw `exam_papers` row (plus the joined subject, when available). */
export interface AdmissionExamPaperRow {
  id: string;
  title: string;
  subject_id: string | null;
  category: string | null;
  exam_type: string | null;
  meta_data: unknown;
  is_published: boolean | null;
  is_premium: boolean | null;
  duration_min: number | null;
  total_marks: number | null;
  pass_mark: number | null;
  default_negative_marks: number | null;
  start_time: string | null;
  end_time: string | null;
  created_at: string | null;
  subjects?: {
    name_bn?: string | null;
    name_en?: string | null;
    slug?: string | null;
  } | null;
}

export interface AdmissionUnit {
  slug: string;
  nameBn: string;
  nameEn: string | null;
}

export interface AdmissionGroup {
  slug: string;
  nameBn: string;
  nameEn: string;
  descriptionBn?: string;
  descriptionEn?: string;
  /** Number of eligible exams per exam type (only known types are counted). */
  examCounts: Record<AdmissionExamType, number>;
  totalExams: number;
}

export interface AdmissionExam {
  id: string;
  title: string;
  groupSlug: string | null;
  examType: AdmissionExamType | null;
  universityId: string | null;
  unit: AdmissionUnit | null;
  year: number | null;
  modelTestNo: number | null;
  durationMin: number | null;
  totalMarks: number | null;
  questionCount: number | null;
  isPublished: boolean;
  isPremium: boolean;
  startTime: string | null;
  endTime: string | null;
  createdAt: string | null;
  order: number | null;
  subjectNameBn: string | null;
  subjectNameEn: string | null;
}

export interface AdmissionUniversity {
  id: string;
  slug: string;
  nameBn: string;
  nameEn: string | null;
  shortName: string | null;
  location: string | null;
  totalExams: number;
  examCounts: Record<AdmissionExamType, number>;
  unitCount: number;
}

export interface AdmissionCatalog {
  groups: AdmissionGroup[];
  universities: AdmissionUniversity[];
  exams: AdmissionExam[];
  /** Papers returned by the database but not usable for browsing. */
  diagnostics: {
    totalPapers: number;
    missingGroup: number;
    missingUniversity: number;
    missingExamType: number;
  };
}

export interface AdmissionUnitSummary extends AdmissionUnit {
  examCount: number;
}

// --------------------------------------------------------------------------
// Existing attempt API contracts (server-issued; no client-calculated scores)
// --------------------------------------------------------------------------

export interface AdmissionAttempt {
  id: string;
  exam_id: string | null;
  kind: string;
  status: 'in_progress' | 'submitted' | 'expired' | 'finalized' | string;
  started_at: string | null;
  deadline_at: string | null;
  submitted_at: string | null;
  server_time: string;
  seconds_remaining: number | null;
  answers_draft: Record<string, string>;
  current_question_index: number;
  question_ids: string[];
}

export interface AdmissionAttemptOption {
  id: string | number;
  text_bn?: string | null;
  text_en?: string | null;
  image_url?: string | null;
}

export interface AdmissionAttemptQuestion {
  id: string;
  subject_id?: string | null;
  type?: string;
  body?: {
    text_bn?: string | null;
    text_en?: string | null;
    image_url?: string | null;
  } | null;
  options?: AdmissionAttemptOption[];
  media_library?: { file_url?: string | null } | null;
  comprehension?: {
    id: string;
    body: string;
    media_library?: { file_url?: string | null } | null;
  } | null;
}

export interface AdmissionAttemptQuestionsResponse {
  attempt_id: string;
  exam_id: string | null;
  started_at: string | null;
  deadline_at: string | null;
  server_time: string;
  questions: AdmissionAttemptQuestion[];
}

// --------------------------------------------------------------------------
// Unit-first admission navigation (Phase 4)
//
// Unit identity comes from the Phase 1 `admission_units` table and
// `exam_papers.admission_unit_id`; the canonical paper mode/session come from
// the Phase 2 `meta_data.exam_mode` / `meta_data.admission_session` keys. The
// sections below are built server-side and only mapped here.
// --------------------------------------------------------------------------

export type AdmissionPaperMode = 'past_exam' | 'subject_practice' | 'model_test';

export interface AdmissionUnitRecord {
  id: string;
  institutionId: string;
  nameBn: string;
  nameEn: string | null;
  code: string;
  displayOrder: number;
  /** Published admission papers linked to this unit. */
  paperCount: number;
}

export interface AdmissionUniversityEntry {
  id: string;
  nameBn: string;
  nameEn: string | null;
  shortName: string | null;
  slug: string | null;
  location: string | null;
  units: AdmissionUnitRecord[];
  paperCount: number;
}

export interface AdmissionUnitPaper {
  id: string;
  title: string;
  titleEn: string | null;
  mode: AdmissionPaperMode | null;
  session: string | null;
  modelTestNo: number | null;
  durationMin: number | null;
  totalMarks: number | null;
  questionCount: number;
  isPremium: boolean;
  startTime: string | null;
  endTime: string | null;
  defaultNegativeMarks: number | null;
}

export interface AdmissionSessionGroup {
  /** `null` when a historical paper declares no usable session. */
  session: string | null;
  papers: AdmissionUnitPaper[];
}

export interface AdmissionChapterOption {
  id: string;
  nameBn: string;
  nameEn: string | null;
  questionCount: number;
}

export interface AdmissionSubjectOption {
  id: string;
  nameBn: string;
  nameEn: string | null;
  slug: string | null;
  isPremium: boolean;
  questionCount: number;
  chapters: AdmissionChapterOption[];
}

export interface AdmissionUnitInfo {
  id: string;
  institutionId: string;
  nameBn: string;
  nameEn: string | null;
  code: string;
  description: string | null;
  displayOrder: number;
}

export interface AdmissionUnitUniversity {
  id: string;
  nameBn: string;
  nameEn: string | null;
  shortName: string | null;
  slug: string | null;
  location: string | null;
}

export interface AdmissionUnitContent {
  unit: AdmissionUnitInfo;
  university: AdmissionUnitUniversity | null;
  pastExams: AdmissionSessionGroup[];
  modelTests: AdmissionUnitPaper[];
  subjects: AdmissionSubjectOption[];
}

export interface AdmissionPracticeInput {
  subject_id: string;
  chapter_id: string | null;
}

export interface AdmissionPracticeStart {
  id: string;
  deadlineAt: string | null;
  secondsRemaining: number | null;
  questionCount: number;
}
