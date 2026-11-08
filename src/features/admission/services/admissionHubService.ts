import { supabase } from '@/shared/lib/supabase';
import {
  isRpcRow,
  mapAnswerKey,
  mapQuestion,
  resolvePagination,
} from '@/features/question-bank/services/questionBankMapper';
import type {
  QuestionAnswerKey,
  QuestionBankQuestion,
  QuestionBankRpcRow,
} from '@/features/question-bank/types/questionBank';
import type {
  AdmissionBankFilters,
  AdmissionBankSubjectFacet,
  AdmissionBankTopicFacet,
  AdmissionBankYearFacet,
  AdmissionHubPaper,
  AdmissionHubUnit,
  AdmissionHubUniversity,
  AdmissionUnitHubData,
} from '../types/admissionHub';

/**
 * Admission hub data access.
 *
 * The hub reads through security-definer RPCs because `public.questions` is
 * not readable by students. Both the catalog and a unit hub come back in one
 * request each, so a grid render never fans out into a query per card.
 *
 * The unit bank reuses the student question-bank row contract, which is why
 * the existing mapper and question card can be shared unchanged.
 */

export const ADMISSION_BANK_PAGE_SIZE = 20;

type RpcError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};
type RpcResult = { data: unknown; error: RpcError | null };

type AdmissionHubRpcClient = {
  rpc(
    fn: 'get_admission_hub_catalog',
    args?: Record<string, never>
  ): Promise<RpcResult>;
  rpc(
    fn: 'get_admission_unit_hub',
    args: { p_institution_slug: string; p_unit_code: string }
  ): Promise<RpcResult>;
  rpc(
    fn: 'get_admission_unit_question_bank_v2',
    args: {
      p_admission_unit_id: string;
      p_exam_year_label: string | null;
      p_subject_id: string | null;
      p_topic_id: string | null;
      p_limit: number;
      p_offset: number;
    }
  ): Promise<RpcResult>;
  rpc(
    fn: 'get_admission_unit_question_answers',
    args: { p_admission_unit_id: string; p_question_ids: string[] }
  ): Promise<RpcResult>;
};

const hubRpc = supabase as unknown as AdmissionHubRpcClient;

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null;

const asInteger = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 0;

const asOptionalInteger = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const asOptionalNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value)
    ? value
    : typeof value === 'string' && value.trim() && Number.isFinite(Number(value))
      ? Number(value)
      : null;

const asBoolean = (value: unknown): boolean => value === true;

const nullIfEmpty = (value: string): string | null =>
  value.trim() ? value : null;

const mapUnit = (raw: unknown): AdmissionHubUnit | null => {
  const row = asRecord(raw);
  const id = asString(row?.id);
  const nameBn = asString(row?.name_bn);
  const code = asString(row?.code);
  if (!row || !id || !nameBn || !code) return null;

  return {
    id,
    nameBn,
    nameEn: asString(row.name_en),
    code,
    displayOrder: asOptionalInteger(row.display_order),
    groupType: asString(row.group_type),
    pastPaperCount: asInteger(row.past_paper_count),
    modelTestCount: asInteger(row.model_test_count),
    questionCount: asInteger(row.question_count),
    isAvailable: asBoolean(row.is_available),
  };
};

const mapUniversity = (raw: unknown): AdmissionHubUniversity | null => {
  const row = asRecord(raw);
  const id = asString(row?.id);
  const nameBn = asString(row?.name_bn);
  const slug = asString(row?.slug);
  if (!row || !id || !nameBn || !slug) return null;

  const units = asArray(row.units)
    .map(mapUnit)
    .filter((unit): unit is AdmissionHubUnit => unit !== null);

  return {
    id,
    nameBn,
    nameEn: asString(row.name_en),
    shortName: asString(row.short_name),
    slug,
    logoUrl: asString(row.logo_url),
    location: asString(row.location),
    displayOrder: asOptionalInteger(row.display_order),
    unitCount: asInteger(row.unit_count) || units.length,
    pastPaperCount: asInteger(row.past_paper_count),
    modelTestCount: asInteger(row.model_test_count),
    questionCount: asInteger(row.question_count),
    units,
  };
};

const mapPaper = (raw: unknown): AdmissionHubPaper | null => {
  const row = asRecord(raw);
  const id = asString(row?.id);
  const title = asString(row?.title);
  const category = row?.category;
  if (
    !row ||
    !id ||
    !title ||
    (category !== 'admission' && category !== 'model_test')
  ) {
    return null;
  }

  return {
    id,
    title,
    titleEn: asString(row.title_en),
    category,
    examYearLabel: asString(row.exam_year_label),
    examSession: asString(row.exam_session),
    durationMin: asOptionalInteger(row.duration_min),
    totalMarks: asOptionalNumber(row.total_marks),
    defaultNegativeMarks: asOptionalNumber(row.default_negative_marks),
    isPremium: asBoolean(row.is_premium),
    startTime: asString(row.start_time),
    endTime: asString(row.end_time),
    questionCount: asInteger(row.question_count),
  };
};

const mapYear = (raw: unknown): AdmissionBankYearFacet | null => {
  const row = asRecord(raw);
  const label = asString(row?.label);
  if (!row || !label) return null;
  return { label, count: asInteger(row.count) };
};

const mapSubject = (raw: unknown): AdmissionBankSubjectFacet | null => {
  const row = asRecord(raw);
  const id = asString(row?.id);
  const nameBn = asString(row?.name_bn);
  if (!row || !id || !nameBn) return null;
  return {
    id,
    nameBn,
    nameEn: asString(row.name_en),
    questionCount: asInteger(row.question_count),
  };
};

const mapTopic = (raw: unknown): AdmissionBankTopicFacet | null => {
  const row = asRecord(raw);
  const id = asString(row?.id);
  const nameBn = asString(row?.name_bn);
  if (!row || !id || !nameBn) return null;
  return {
    id,
    subjectId: asString(row.subject_id),
    chapterId: asString(row.chapter_id),
    nameBn,
    nameEn: asString(row.name_en),
    questionCount: asInteger(row.question_count),
  };
};

const mapList = <T>(raw: unknown, mapper: (value: unknown) => T | null): T[] =>
  asArray(raw)
    .map(mapper)
    .filter((value): value is T => value !== null);

export async function fetchAdmissionHubCatalog(): Promise<
  AdmissionHubUniversity[]
> {
  const { data, error } = await hubRpc.rpc('get_admission_hub_catalog');
  if (error) throw error;

  const payload = asRecord(data);
  return mapList(payload?.universities, mapUniversity);
}

export async function fetchAdmissionUnitHub(
  institutionSlug: string,
  unitCode: string
): Promise<AdmissionUnitHubData | null> {
  const { data, error } = await hubRpc.rpc('get_admission_unit_hub', {
    p_institution_slug: institutionSlug,
    p_unit_code: unitCode,
  });
  if (error) throw error;
  if (data === null || data === undefined) return null;

  const payload = asRecord(data);
  const unit = asRecord(payload?.unit);
  const university = asRecord(payload?.university);
  const unitId = asString(unit?.id);
  const unitNameBn = asString(unit?.name_bn);
  const unitCodeValue = asString(unit?.code);
  const universityId = asString(university?.id);
  const universityNameBn = asString(university?.name_bn);
  const universitySlug = asString(university?.slug);

  if (
    !payload ||
    !unit ||
    !university ||
    !unitId ||
    !unitNameBn ||
    !unitCodeValue ||
    !universityId ||
    !universityNameBn ||
    !universitySlug
  ) {
    return null;
  }

  const bank = asRecord(payload.bank);

  return {
    unit: {
      id: unitId,
      nameBn: unitNameBn,
      nameEn: asString(unit.name_en),
      code: unitCodeValue,
      description: asString(unit.description),
      displayOrder: asOptionalInteger(unit.display_order),
      groupType: asString(unit.group_type),
    },
    university: {
      id: universityId,
      nameBn: universityNameBn,
      nameEn: asString(university.name_en),
      shortName: asString(university.short_name),
      slug: universitySlug,
      logoUrl: asString(university.logo_url),
    },
    pastPapers: mapList(payload.past_papers, mapPaper).filter(
      (paper) => paper.category === 'admission'
    ),
    modelTests: mapList(payload.model_tests, mapPaper).filter(
      (paper) => paper.category === 'model_test'
    ),
    bank: {
      total: asInteger(bank?.total),
      years: mapList(bank?.years, mapYear),
      subjects: mapList(bank?.subjects, mapSubject),
      topics: mapList(bank?.topics, mapTopic),
    },
  };
}

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
    supabase
      .from('bookmarks')
      .select('question_id')
      .eq('user_id', userId)
      .in('question_id', questionIds),
    supabase
      .from('wrong_answers')
      .select('question_id')
      .eq('user_id', userId)
      .in('question_id', questionIds),
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

const readTotalCount = (rows: QuestionBankRpcRow[]): number => {
  for (const row of rows) {
    if (typeof row.total_count === 'number' && Number.isFinite(row.total_count)) {
      return row.total_count;
    }
  }
  return 0;
};

export interface AdmissionBankPage {
  questions: QuestionBankQuestion[];
  total: number;
  nextOffset: number | null;
}

export async function fetchAdmissionBankPage(
  unitId: string,
  filters: AdmissionBankFilters,
  offset = 0
): Promise<AdmissionBankPage> {
  const { data, error } = await hubRpc.rpc(
    'get_admission_unit_question_bank_v2',
    {
      p_admission_unit_id: unitId,
      p_exam_year_label: nullIfEmpty(filters.year),
      p_subject_id: nullIfEmpty(filters.subjectId),
      p_topic_id: nullIfEmpty(filters.topicId),
      p_limit: ADMISSION_BANK_PAGE_SIZE,
      p_offset: offset,
    }
  );
  if (error) throw error;

  const rows = asArray(data).filter(isRpcRow);
  const meta = await getUserMeta(rows.map((row) => row.id));
  const questions = rows.map((row) => mapQuestion(row, meta));
  const { total, nextOffset } = resolvePagination({
    offset,
    limit: ADMISSION_BANK_PAGE_SIZE,
    received: questions.length,
    total: readTotalCount(rows),
  });

  return { questions, total, nextOffset };
}

export async function fetchAdmissionBankAnswers(
  unitId: string,
  questionIds: string[]
): Promise<QuestionAnswerKey[]> {
  const ids = Array.from(
    new Set(questionIds.map((id) => id.trim()).filter(Boolean))
  );
  if (ids.length === 0) return [];

  const { data, error } = await hubRpc.rpc(
    'get_admission_unit_question_answers',
    { p_admission_unit_id: unitId, p_question_ids: ids }
  );
  if (error) throw error;

  return asArray(data)
    .map(mapAnswerKey)
    .filter((value): value is QuestionAnswerKey => value !== null);
}
