import type { QuestionBankFilterState } from '../types/questionBank';

/**
 * The argument set of `get_student_question_bank_v3`, kept in its own module so
 * it can be tested without a Supabase client.
 *
 * Level is always sent, even though the server ignores it for a student in
 * admission prep: the client states what it wants and the server decides what
 * it may have.
 */

export type QuestionBankV3Args = {
  p_level: string;
  p_track: string | null;
  p_include_other_admission_tracks: boolean;
  p_subject_id: string | null;
  p_chapter_id: string | null;
  p_topic_id: string | null;
  p_sort: string;
  p_search: string | null;
  p_bookmarked_only: boolean;
  p_mistakes_only: boolean;
  p_premium_only: boolean;
  p_institution_id: string | null;
  p_admission_unit_id: string | null;
  p_year: string | null;
  p_limit: number;
  p_offset: number;
  /** One exam paper of the unit, when the list was opened from a paper card. */
  p_exam_id: string | null;
};

const orNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export const buildQuestionBankV3Args = (
  filters: QuestionBankFilterState,
  offset: number,
  limit: number
): QuestionBankV3Args => ({
  p_level: filters.level,
  p_track: filters.track || null,
  p_include_other_admission_tracks: filters.allTracks,
  p_subject_id: orNull(filters.subjectId),
  p_chapter_id: orNull(filters.chapterId),
  p_topic_id: orNull(filters.topicId),
  p_sort: filters.sortBy,
  p_search: orNull(filters.search),
  p_bookmarked_only: filters.bookmarkedOnly,
  p_mistakes_only: filters.mistakesOnly,
  p_premium_only: filters.premiumOnly,
  // One institution parameter for both halves of the bank: a university from
  // the admission drill-down, or a board/college preset from the HSC hub.
  p_institution_id: orNull(filters.universityId) ?? orNull(filters.institutionId),
  p_admission_unit_id: orNull(filters.admissionUnitId),
  p_year: orNull(filters.year),
  p_limit: limit,
  p_offset: offset,
  p_exam_id: orNull(filters.examId),
});
