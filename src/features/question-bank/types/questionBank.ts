import type { Json } from '@/shared/types/supabase';

export type QuestionType = 'MCQ' | 'CQ' | 'SQ' | 'Creative' | string;
export type DifficultyLevel = 'easy' | 'medium' | 'hard' | string;
export type SourceType =
  | 'board_exam'
  | 'admission'
  | 'model_test'
  | 'textbook'
  | 'guidebook'
  | 'worksheet'
  | 'unknown'
  | string;

export interface QuestionBody {
  text_bn?: string;
  text_en?: string;
  image_url?: string | null;
  [key: string]: Json | undefined;
}

export interface QuestionOption {
  id: string | number;
  text_bn?: string;
  text_en?: string;
  image_url?: string | null;
  /** Never populated by the list mapper; answer keys come from their own RPC. */
  isCorrect?: boolean;
}

export interface QuestionExplanation {
  bn: string | null;
  en: string | null;
}

export interface QuestionExamReference {
  [key: string]: unknown;
  year?: string | number;
  board?: string;
  institution_name?: string;
  exam_name?: string;
  source_kind?: string;
  eiin?: string;
  code?: string;
}

export interface QuestionBankQuestion {
  id: string;
  type: QuestionType;
  difficultyLevel: DifficultyLevel | null;
  sourceType: SourceType | null;
  explanation: QuestionExplanation | null;
  tags: string[];
  examReferences: QuestionExamReference[];
  body: QuestionBody;
  options: QuestionOption[];
  subjectId: string | null;
  subjectNameBn: string | null;
  subjectNameEn: string | null;
  chapterId: string | null;
  chapterNameBn: string | null;
  chapterNameEn: string | null;
  topicId: string | null;
  topicNameBn: string | null;
  topicNameEn: string | null;
  isPremium: boolean;
  /** Premium row the caller cannot read: the server returned it redacted. */
  isLocked: boolean;
  isBookmarked: boolean;
  isWrongAnswered: boolean;
  totalAttempts: number;
  correctAttempts: number;
  createdAt: string | null;
  /** Every level this question is visible at. Two means a deliberate dual placement. */
  levels: QuestionBankLevel[];
  /** The tags the server used to derive `levels`. */
  tracks: string[];
  /** The reference the current filter is about, when the server could resolve one. */
  examYear: string | null;
  institutionShortName: string | null;
  admissionUnitCode: string | null;
}

export interface QuestionBankSubject {
  id: string;
  name_bn: string;
  name_en: string | null;
  slug: string;
  is_premium: boolean | null;
  sequence: number | null;
}

export interface QuestionBankChapter {
  id: string;
  subject_id: string | null;
  name_bn: string;
  name_en: string | null;
  slug: string;
  is_premium: boolean | null;
  sequence: number | null;
}

export interface QuestionBankTopic {
  id: string;
  chapter_id: string | null;
  name_bn: string;
  name_en: string | null;
  slug: string;
  is_premium: boolean | null;
  sequence: number | null;
  total_questions: number | null;
}

export interface QuestionBankInstitution {
  id: string;
  name_bn: string;
  name_en: string | null;
  type: string;
  eiin: string | null;
  code: string | null;
}

export interface QuestionBankFiltersData {
  subjects: QuestionBankSubject[];
  chapters: QuestionBankChapter[];
  topics: QuestionBankTopic[];
  boards: QuestionBankInstitution[];
  colleges: QuestionBankInstitution[];
  admissions: QuestionBankInstitution[];
}

/** HSC revision or admission preparation. Which one a student may pick is not their choice. */
export type QuestionBankLevel = 'hsc' | 'admission';

/** The three goal-specific admission tracks. The generic `admission` tag is not one. */
export type QuestionBankTrack = 'varsity' | 'medical' | 'engineering';

export interface QuestionBankFilterState {
  search: string;
  subjectId: string;
  chapterId: string;
  topicId: string;
  institutionType: string;
  institutionEiin: string; // Changed from institutionName to institutionEiin
  year: string;
  bookmarkedOnly: boolean;
  mistakesOnly: boolean;
  premiumOnly: boolean;
  sortBy: 'newest' | 'oldest' | 'most_attempted' | 'least_attempted';
  /** The tab the student is on. The server still decides what they may see. */
  level: QuestionBankLevel;
  /** Goal track for the admission tab. Empty means every admission track. */
  track: QuestionBankTrack | '';
  /** "সব ভর্তি প্রশ্ন": widens the goal, never the level. */
  allTracks: boolean;
  /** University id for the admission filters. */
  universityId: string;
  /** Admission unit id. */
  admissionUnitId: string;
  /**
   * Board or college id for an HSC preset. Universities keep `universityId`,
   * which the filter sheet reads, so the two never fight over one selection.
   */
  institutionId: string;
  /**
   * The URL asked for the list while nothing scopes it, which is how the hub's
   * search reaches the list instead of the subject picker.
   */
  listView: boolean;
}

/** One option of one filter, as counted by get_question_bank_facets. */
export interface QuestionBankFacetOption {
  id: string;
  parentId: string | null;
  labelBn: string | null;
  labelEn: string | null;
  count: number;
}

export type QuestionBankFacetName =
  | 'subject'
  | 'chapter'
  | 'topic'
  | 'institution'
  | 'admission_unit'
  | 'exam_year';

export type QuestionBankFacets = Record<
  QuestionBankFacetName,
  QuestionBankFacetOption[]
>;

export interface QuestionBankStats {
  total: number;
  bookmarked: number;
  mistakes: number;
  mcq: number;
  board: number;
  premium: number;
}

/** Answer-key row from `get_student_question_bank_answers`. */
export interface QuestionAnswerKeyRpcRow {
  id: string;
  correct_option_ids: unknown;
}

export interface QuestionAnswerKey {
  questionId: string;
  correctOptionIds: string[];
}

/**
 * One row as returned by `get_student_question_bank*`. Every field is `unknown`
 * on purpose: the payload is validated field by field in the mapper instead of
 * being trusted because a cast said so.
 */
export interface QuestionBankRpcRow {
  id: string;
  type: string | null;
  difficulty_level: string | null;
  source_type: string | null;
  tags: unknown;
  exam_references: unknown;
  subject_id: string | null;
  chapter_id: string | null;
  topic_id: string | null;
  total_attempts: number | null;
  correct_attempts: number | null;
  created_at: string | null;
  /** v2 only: full match count for the active filter set. */
  total_count?: number | null;
  body: unknown;
  options: unknown;
  explanation: unknown;
  subjects: unknown;
  chapters: unknown;
  topics: unknown;
  /** v3 only. Absent on the v2 fallback path. */
  levels?: unknown;
  tracks?: unknown;
  exam_year?: unknown;
  institution?: unknown;
  admission_unit?: unknown;
}

/**
 * `paged`  — RPC v2 is deployed: filters, counts and paging are server-side.
 * `legacy` — only RPC v1 is deployed: the page was filtered locally and is
 *            capped by the function's own `limit 100`.
 */
export type QuestionBankDataMode = 'paged' | 'legacy';

export interface QuestionBankPage {
  questions: QuestionBankQuestion[];
  /** Matching rows for the active filters (server count in `paged` mode). */
  total: number;
  /** Offset to request next, or `null` when there is nothing more. */
  nextOffset: number | null;
  mode: QuestionBankDataMode;
  /** True when the response may be missing rows because the server capped it. */
  capped: boolean;
  stats: QuestionBankStats;
}

export const DEFAULT_QUESTION_BANK_FILTERS: QuestionBankFilterState = {
  search: '',
  subjectId: '',
  chapterId: '',
  topicId: '',
  institutionType: '',
  institutionEiin: '', // Changed to institutionEiin
  year: '',
  bookmarkedOnly: false,
  mistakesOnly: false,
  premiumOnly: false,
  sortBy: 'newest',
  level: 'hsc',
  track: '',
  allTracks: false,
  universityId: '',
  admissionUnitId: '',
  institutionId: '',
  listView: false,
};

export function isQuestionBody(value: unknown): value is QuestionBody {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isQuestionOptions(value: unknown): value is QuestionOption[] {
  return Array.isArray(value);
}
