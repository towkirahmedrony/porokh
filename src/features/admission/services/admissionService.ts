import apiClient from '@/shared/lib/apiClient';
import { supabase } from '@/shared/lib/supabase';
import { buildAdmissionCatalog } from '../lib/admissionAdapter';
import {
  buildUniversityUnits,
  mapUnitContent,
  type RawAdmissionInstitutionRow,
  type RawAdmissionUnitRow,
} from '../lib/admissionUnitAdapter';
import type {
  AdmissionCatalog,
  AdmissionExamPaperRow,
  AdmissionInstitutionRow,
  AdmissionPracticeInput,
  AdmissionPracticeStart,
  AdmissionUnitContent,
  AdmissionUniversityEntry,
} from '../types/admission';

/**
 * Admission data-access layer.
 *
 * Everything here reads the existing Porokh tables through the existing
 * Supabase client. No schema, RLS policy or backend route is changed.
 *
 * Admission content contract:
 * - `exam_papers.category = 'admission'`
 * - `exam_papers.is_published = true` for browsable papers
 * - optional `exam_papers.meta_data` keys documented in admissionAdapter.ts
 * - `institutions.type = 'admission'` for the university directory
 */

const ADMISSION_CATEGORY = 'admission';

/**
 * The committed Supabase type snapshot predates the Phase 1 admission migration
 * (`admission_units` and `exam_papers.admission_unit_id` are not in it yet).
 * This helper is the single place that steps outside those types; the returned
 * rows are always mapped by `buildUniversityUnits`, which reads only declared
 * fields and drops anything malformed.
 */
const untypedFrom = (table: 'admission_units' | 'exam_papers'): any =>
  (supabase as unknown as { from: (name: string) => any }).from(table);

const ADMISSION_PAPER_SELECT = `
  id,
  title,
  subject_id,
  category,
  exam_type,
  meta_data,
  is_published,
  is_premium,
  duration_min,
  total_marks,
  pass_mark,
  default_negative_marks,
  start_time,
  end_time,
  created_at,
  subjects:subject_id (
    name_bn,
    name_en,
    slug
  )
`;

const INSTITUTION_SELECT = `
  id,
  name_bn,
  name_en,
  short_name,
  slug,
  code,
  aliases,
  location,
  district,
  display_order,
  type,
  is_active
`;

const COUNT_CHUNK_SIZE = 200;

async function fetchQuestionCounts(
  examIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (examIds.length === 0) return counts;

  const chunks: string[][] = [];
  for (let index = 0; index < examIds.length; index += COUNT_CHUNK_SIZE) {
    chunks.push(examIds.slice(index, index + COUNT_CHUNK_SIZE));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await supabase
        .from('exam_paper_questions')
        .select('exam_id')
        .in('exam_id', chunk);

      return { data, error };
    })
  );

  for (const result of results) {
    // Question counts are optional metadata. A failed count must not hide the
    // exams themselves, so this is the only intentionally non-fatal read.
    if (result.error || !result.data) continue;

    for (const row of result.data) {
      if (!row.exam_id) continue;
      counts.set(row.exam_id, (counts.get(row.exam_id) ?? 0) + 1);
    }
  }

  return counts;
}

export const admissionService = {
  async getExamPapers(): Promise<AdmissionExamPaperRow[]> {
    const { data, error } = await supabase
      .from('exam_papers')
      .select(ADMISSION_PAPER_SELECT)
      .eq('category', ADMISSION_CATEGORY)
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    return (data ?? []) as unknown as AdmissionExamPaperRow[];
  },

  async getExamPaper(examId: string): Promise<AdmissionExamPaperRow | null> {
    if (!examId) return null;

    const { data, error } = await supabase
      .from('exam_papers')
      .select(ADMISSION_PAPER_SELECT)
      .eq('id', examId)
      .maybeSingle();

    if (error) throw new Error(error.message);

    return (data as unknown as AdmissionExamPaperRow) ?? null;
  },

  async getInstitutions(): Promise<AdmissionInstitutionRow[]> {
    const { data, error } = await supabase
      .from('institutions')
      .select(INSTITUTION_SELECT)
      // The backend accepts both kinds for admission sources; keep both so
      // universities created from `exam_references.source_kind` are visible.
      .in('type', [ADMISSION_CATEGORY, 'university'])
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('name_bn', { ascending: true });

    if (error) throw new Error(error.message);

    return (data ?? []) as AdmissionInstitutionRow[];
  },

  async getCatalog(): Promise<AdmissionCatalog> {
    const [papers, institutions] = await Promise.all([
      this.getExamPapers(),
      this.getInstitutions(),
    ]);

    const questionCounts = await fetchQuestionCounts(
      papers.map((paper) => paper.id)
    );

    return buildAdmissionCatalog(papers, institutions, questionCounts);
  },

  /**
   * Unit-first navigation source: active units grouped by their active
   * university. Reading `admission_units` directly is the Phase 1 contract and is
   * guarded by the table's active-only RLS policy.
   */
  async getUniversityUnits(): Promise<AdmissionUniversityEntry[]> {
    const [unitsResult, institutionsResult, papersResult] = await Promise.all([
      untypedFrom('admission_units')
        .select('id, institution_id, name_bn, name_en, code, display_order, is_active')
        .eq('is_active', true)
        .order('display_order', { ascending: true }),
      supabase
        .from('institutions')
        .select('id, name_bn, name_en, short_name, slug, location, district, is_active')
        .eq('is_active', true)
        .order('name_bn', { ascending: true }),
      untypedFrom('exam_papers')
        .select('id, admission_unit_id')
        .eq('category', ADMISSION_CATEGORY)
        .eq('is_published', true)
        .not('admission_unit_id', 'is', null),
    ]);

    if (unitsResult.error) throw new Error(unitsResult.error.message);
    if (institutionsResult.error) throw new Error(institutionsResult.error.message);

    const paperCounts = new Map<string, number>();

    // Paper counts are presentation metadata. A failed count must not hide the
    // units themselves, so this read is the only intentionally non-fatal one.
    if (!papersResult.error && papersResult.data) {
      for (const row of papersResult.data as Array<{ admission_unit_id: string | null }>) {
        const unitId = row.admission_unit_id;
        if (!unitId) continue;
        paperCounts.set(unitId, (paperCounts.get(unitId) ?? 0) + 1);
      }
    }

    return buildUniversityUnits(
      (unitsResult.data ?? []) as unknown as RawAdmissionUnitRow[],
      (institutionsResult.data ?? []) as unknown as RawAdmissionInstitutionRow[],
      paperCounts
    );
  },

  /**
   * Unit screen content assembled by the backend: past papers grouped by
   * session, unit model tests and the unit's subject/chapter question pool.
   * Question counts come from the server so the answer key stays server-side.
   */
  async getUnitContent(unitId: string): Promise<AdmissionUnitContent> {
    if (!unitId) throw new Error('Admission unit id is required');

    const response = await apiClient.get(
      `/admissions/units/${encodeURIComponent(unitId)}/content`
    );
    const envelope = response.data as { data?: unknown } | null;
    const payload =
      envelope && typeof envelope === 'object' && 'data' in envelope && envelope.data
        ? envelope.data
        : response.data;

    return mapUnitContent(payload);
  },

  /** Starts a repeatable unit-scoped subject practice attempt. */
  async startPractice(
    unitId: string,
    input: AdmissionPracticeInput
  ): Promise<AdmissionPracticeStart> {
    const response = await apiClient.post(
      `/admissions/units/${encodeURIComponent(unitId)}/practice`,
      {
        subject_id: input.subject_id,
        chapter_id: input.chapter_id,
      }
    );

    const envelope = response.data as { data?: Record<string, unknown> } | null;
    const data =
      envelope && typeof envelope === 'object' && 'data' in envelope && envelope.data
        ? envelope.data
        : (response.data as Record<string, unknown>);

    if (!data || typeof data.id !== 'string' || data.id.length === 0) {
      throw new Error('The server did not return a practice attempt id.');
    }

    return {
      id: data.id,
      deadlineAt: typeof data.deadline_at === 'string' ? data.deadline_at : null,
      secondsRemaining:
        typeof data.seconds_remaining === 'number' ? data.seconds_remaining : null,
      questionCount: Number(data.question_count ?? 0) || 0,
    };
  },
};
