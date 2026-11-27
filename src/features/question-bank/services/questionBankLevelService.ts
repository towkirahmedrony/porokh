import { supabase } from '@/shared/lib/supabase';
import type {
  QuestionBankFacetName,
  QuestionBankFacetOption,
  QuestionBankFacets,
  QuestionBankFilterState,
} from '../types/questionBank';

/**
 * Facet counts for the filter sheet.
 *
 * One round trip returns every option with the number of questions it would
 * yield, computed with its own filter dropped. An option with no question is
 * never returned, so a subject that holds nothing at this level simply is not
 * offered.
 */

const FACET_NAMES: QuestionBankFacetName[] = [
  'subject',
  'chapter',
  'topic',
  'institution',
  'admission_unit',
  'exam_year',
];

export const emptyQuestionBankFacets = (): QuestionBankFacets => ({
  subject: [],
  chapter: [],
  topic: [],
  institution: [],
  admission_unit: [],
  exam_year: [],
});

const isFacetName = (value: unknown): value is QuestionBankFacetName =>
  typeof value === 'string' && (FACET_NAMES as readonly string[]).includes(value);

type FacetRpcClient = {
  rpc(
    fn: 'get_question_bank_facets',
    args: {
      p_level: string;
      p_track: string | null;
      p_include_other_admission_tracks: boolean;
      p_subject_id: string | null;
      p_chapter_id: string | null;
      p_topic_id: string | null;
      p_institution_id: string | null;
      p_admission_unit_id: string | null;
      p_year: string | null;
      p_search: string | null;
      p_bookmarked_only: boolean;
      p_mistakes_only: boolean;
      p_premium_only: boolean;
    }
  ): Promise<{ data: unknown; error: { message?: string; code?: string } | null }>;
};

const facetRpc = supabase as unknown as FacetRpcClient;

const orNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const toOption = (raw: Record<string, unknown>): QuestionBankFacetOption | null => {
  if (typeof raw.id !== 'string' || !raw.id) return null;

  const count = typeof raw.cnt === 'number' ? raw.cnt : Number(raw.cnt);
  if (!Number.isFinite(count) || count <= 0) return null;

  return {
    id: raw.id,
    parentId: typeof raw.parent_id === 'string' ? raw.parent_id : null,
    labelBn: typeof raw.label_bn === 'string' ? raw.label_bn : null,
    labelEn: typeof raw.label_en === 'string' ? raw.label_en : null,
    count,
  };
};

export async function fetchQuestionBankFacets(
  filters: QuestionBankFilterState
): Promise<QuestionBankFacets> {
  const { data, error } = await facetRpc.rpc('get_question_bank_facets', {
    p_level: filters.level,
    p_track: filters.track || null,
    p_include_other_admission_tracks: filters.allTracks,
    p_subject_id: orNull(filters.subjectId),
    p_chapter_id: orNull(filters.chapterId),
    p_topic_id: orNull(filters.topicId),
    p_institution_id: orNull(filters.universityId),
    p_admission_unit_id: orNull(filters.admissionUnitId),
    p_year: orNull(filters.year),
    p_search: orNull(filters.search),
    p_bookmarked_only: filters.bookmarkedOnly,
    p_mistakes_only: filters.mistakesOnly,
    p_premium_only: filters.premiumOnly,
  });

  if (error) throw error;

  const facets = emptyQuestionBankFacets();
  if (!Array.isArray(data)) return facets;

  for (const raw of data) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    if (!isFacetName(row.facet)) continue;

    const option = toOption(row);
    if (option) facets[row.facet].push(option);
  }

  return facets;
}
