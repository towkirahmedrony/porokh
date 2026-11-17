import { supabase } from '@/shared/lib/supabase';
import type {
  QuestionAnswerKey,
  QuestionBankChapter,
  QuestionBankFilterState,
  QuestionBankFiltersData,
  QuestionBankInstitution,
  QuestionBankPage,
  QuestionBankQuestion,
  QuestionBankRpcRow,
  QuestionBankSubject,
  QuestionBankTopic,
} from '../types/questionBank';
import {
  applyClientSideFilters,
  buildStats,
  dedupeQuestions,
  isRpcRow,
  mapAnswerKey,
  mapQuestion,
  resolvePagination,
} from './questionBankMapper';
import { isMissingRpcError } from './questionBankErrors';

/**
 * Student question bank data access.
 *
 * Architecture: the frontend reads questions through the student RPC
 * (`get_student_question_bank*`). Direct table access is not available to
 * students — `public.questions` is not readable by the `authenticated` role —
 * and the RPC is the only path that applies premium redaction, live-exam
 * exclusion and answer-key suppression inside the database.
 *
 * Two RPC versions are supported:
 *   * v2 (`..._v2`, 13 args) — paginated, server-side search/filter/count.
 *   * v1 (4 args) — kept as a compatibility fallback for projects where the v2
 *     migration has not been applied yet. It returns at most 100 rows with no
 *     offset, so the frontend filters and slices that page locally and labels
 *     the result as capped.
 *
 * The fallback is decided per request from the RPC error, so either deployment
 * order (frontend first or migration first) keeps working.
 */

/** Rows requested per page in v2 mode. */
export const QUESTION_BANK_PAGE_SIZE = 20;

/** Hard cap of the v1 RPC (`limit 100` inside the function). */
export const LEGACY_ROW_CAP = 100;

type V2Args = {
  p_subject_id: string | null;
  p_chapter_id: string | null;
  p_topic_id: string | null;
  p_sort: string;
  p_search: string | null;
  p_bookmarked_only: boolean;
  p_mistakes_only: boolean;
  p_premium_only: boolean;
  p_institution_type: string | null;
  p_institution_eiin: string | null;
  p_year: string | null;
  p_limit: number;
  p_offset: number;
};

type V1Args = {
  p_subject_id: string | null;
  p_chapter_id: string | null;
  p_topic_id: string | null;
  p_sort: string;
};

type AnswerKeyArgs = {
  p_question_ids: string[];
};

/**
 * Minimal typed view of the Supabase client for the two RPCs this feature
 * needs. The generated `Database` type has no entry for either function, so the
 * response is described here and validated before use instead of cast to `any`.
 */
type QuestionBankRpcClient = {
  rpc(fn: 'get_student_question_bank_v2', args: V2Args): Promise<RpcResult>;
  rpc(fn: 'get_student_question_bank', args: V1Args): Promise<RpcResult>;
  rpc(
    fn: 'get_student_question_bank_answers',
    args: AnswerKeyArgs
  ): Promise<RpcResult>;
};

type RpcError = { code?: string; message?: string; details?: string; hint?: string };
type RpcResult = { data: unknown; error: RpcError | null };

const questionBankRpc = supabase as unknown as QuestionBankRpcClient;

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const orNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

async function getCurrentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.id ?? null;
}

async function getUserMeta(questionIds: string[]) {
  const userId = await getCurrentUserId();
  if (!userId || questionIds.length === 0) {
    return { bookmarkedIds: new Set<string>(), wrongIds: new Set<string>() };
  }

  const [
    { data: bookmarks, error: bookmarksError },
    { data: wrongAnswers, error: wrongAnswersError },
  ] = await Promise.all([
    supabase.from('bookmarks').select('question_id').eq('user_id', userId).in('question_id', questionIds),
    supabase.from('wrong_answers').select('question_id').eq('user_id', userId).in('question_id', questionIds),
  ]);

  if (bookmarksError) throw bookmarksError;
  if (wrongAnswersError) throw wrongAnswersError;

  return {
    bookmarkedIds: new Set(
      (bookmarks ?? [])
        .map((item) => item.question_id)
        .filter((value): value is string => Boolean(value))
    ),
    wrongIds: new Set(
      (wrongAnswers ?? [])
        .map((item) => item.question_id)
        .filter((value): value is string => Boolean(value))
    ),
  };
}

const toV2Args = (
  filters: QuestionBankFilterState,
  offset: number,
  limit: number
): V2Args => ({
  p_subject_id: orNull(filters.subjectId),
  p_chapter_id: orNull(filters.chapterId),
  p_topic_id: orNull(filters.topicId),
  p_sort: filters.sortBy,
  p_search: orNull(filters.search),
  p_bookmarked_only: filters.bookmarkedOnly,
  p_mistakes_only: filters.mistakesOnly,
  p_premium_only: filters.premiumOnly,
  p_institution_type: orNull(filters.institutionType),
  p_institution_eiin: orNull(filters.institutionEiin),
  p_year: orNull(filters.year),
  p_limit: limit,
  p_offset: offset,
});

const readTotalCount = (rows: QuestionBankRpcRow[]): number => {
  for (const row of rows) {
    if (typeof row.total_count === 'number' && Number.isFinite(row.total_count)) {
      return row.total_count;
    }
  }
  return 0;
};

/**
 * Fetches one page of questions.
 *
 * `offset` is the number of rows already shown. The returned `nextOffset` is
 * `null` when the page is the last one.
 */
export async function fetchQuestionPage(
  filters: QuestionBankFilterState,
  offset = 0
): Promise<QuestionBankPage> {
  const limit = QUESTION_BANK_PAGE_SIZE;

  const v2 = await questionBankRpc.rpc('get_student_question_bank_v2', toV2Args(filters, offset, limit));

  if (!v2.error) {
    const rows = asArray(v2.data).filter(isRpcRow);
    const meta = await getUserMeta(rows.map((row) => row.id));
    const questions = rows.map((row) => mapQuestion(row, meta));
    const { total, nextOffset } = resolvePagination({
      offset,
      limit,
      received: questions.length,
      total: readTotalCount(rows),
    });

    return {
      questions,
      total,
      nextOffset,
      mode: 'paged',
      capped: false,
      stats: buildStats(questions),
    };
  }

  if (!isMissingRpcError(v2.error)) throw v2.error;

  // ---- v1 compatibility path ---------------------------------------------
  if (offset > 0) {
    // v1 cannot page; a "load more" request against it is a no-op.
    return {
      questions: [],
      total: offset,
      nextOffset: null,
      mode: 'legacy',
      capped: true,
      stats: buildStats([]),
    };
  }

  const v1 = await questionBankRpc.rpc('get_student_question_bank', {
    p_subject_id: orNull(filters.subjectId),
    p_chapter_id: orNull(filters.chapterId),
    p_topic_id: orNull(filters.topicId),
    p_sort: filters.sortBy,
  });

  if (v1.error) throw v1.error;

  const rows = asArray(v1.data).filter(isRpcRow);
  const meta = await getUserMeta(rows.map((row) => row.id));
  // v1 applies no filters server-side, so the whole filter pipeline runs here.
  const questions = dedupeQuestions(
    applyClientSideFilters(rows.map((row) => mapQuestion(row, meta)), filters)
  );

  return {
    questions,
    total: questions.length,
    nextOffset: null,
    mode: 'legacy',
    // v1 returns at most 100 rows before any filtering; at the cap the result
    // may be incomplete, so the UI has to say so instead of implying "all".
    capped: rows.length >= LEGACY_ROW_CAP,
    stats: buildStats(questions),
  };
}

/**
 * Answer keys are a separate, authenticated-only read. The list payload never
 * carries them, so the browser only asks for the ids it is already rendering
 * and never needs a second table read with answer columns.
 */
export async function fetchQuestionAnswers(
  questionIds: string[]
): Promise<QuestionAnswerKey[]> {
  const ids = Array.from(
    new Set(questionIds.map((id) => id.trim()).filter(Boolean))
  );
  if (ids.length === 0) return [];

  const { data, error } = await questionBankRpc.rpc(
    'get_student_question_bank_answers',
    { p_question_ids: ids }
  );
  if (error) throw error;

  return asArray(data)
    .map(mapAnswerKey)
    .filter((value): value is QuestionAnswerKey => value !== null);
}

export async function getQuestionBankFilters(): Promise<QuestionBankFiltersData> {
  const [
    { data: subjects, error: subjectsError },
    { data: chapters, error: chaptersError },
    { data: topics, error: topicsError },
    { data: institutions, error: institutionsError },
  ] = await Promise.all([
    supabase.from('subjects').select('id, name_bn, name_en, slug, is_premium, sequence').eq('is_active', true).order('sequence', { ascending: true }),
    supabase.from('chapters').select('id, subject_id, name_bn, name_en, slug, is_premium, sequence').eq('is_active', true).order('sequence', { ascending: true }),
    supabase.from('topics').select('id, chapter_id, name_bn, name_en, slug, is_premium, sequence, total_questions').eq('is_active', true).order('sequence', { ascending: true }),
    supabase.from('institutions').select('id, name_bn, name_en, type, eiin, code').in('type', ['board', 'college', 'admission', 'university']).eq('is_active', true).order('name_bn', { ascending: true }),
  ]);

  if (subjectsError) throw subjectsError;
  if (chaptersError) throw chaptersError;
  if (topicsError) throw topicsError;
  if (institutionsError) throw institutionsError;

  const allInstitutions = (institutions ?? []) as QuestionBankInstitution[];

  return {
    subjects: (subjects ?? []) as QuestionBankSubject[],
    chapters: (chapters ?? []) as QuestionBankChapter[],
    topics: (topics ?? []) as QuestionBankTopic[],
    boards: allInstitutions.filter((inst) => inst.type === 'board'),
    colleges: allInstitutions.filter((inst) => inst.type === 'college'),
    admissions: allInstitutions.filter(
      (inst) => inst.type === 'admission' || inst.type === 'university'
    ),
  };
}

export async function toggleBookmark(questionId: string, isBookmarked: boolean): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('AUTH_REQUIRED');

  if (isBookmarked) {
    const { error } = await supabase.from('bookmarks').delete().eq('user_id', userId).eq('question_id', questionId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('bookmarks').insert({ user_id: userId, question_id: questionId });
  if (error) throw error;
}

/** Exposed for tests and callers that need the mapped shape only. */
export type { QuestionBankQuestion };
