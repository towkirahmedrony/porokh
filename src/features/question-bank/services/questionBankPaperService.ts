import { supabase } from '@/shared/lib/supabase';
import type { QuestionBankFilterState } from '../types/questionBank';
import type { QuestionBankPaper } from '../utils/questionBankPaper';

/**
 * One row per exam paper of a unit, not per year: a year sat in four shifts is
 * four papers, and each is the thing a student actually opens. Counts come from
 * the server so premium redaction and the live-paper rule stay server-side.
 */

type PaperRpcClient = {
  rpc(
    fn: 'get_question_bank_papers',
    args: {
      p_level: string;
      p_track: string | null;
      p_include_other_admission_tracks: boolean;
      p_institution_id: string | null;
      p_admission_unit_id: string | null;
    }
  ): Promise<{ data: unknown; error: { message?: string; code?: string } | null }>;
};

const paperRpc = supabase as unknown as PaperRpcClient;

const orNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export async function fetchUnitPapers(
  filters: QuestionBankFilterState
): Promise<QuestionBankPaper[]> {
  const { data, error } = await paperRpc.rpc('get_question_bank_papers', {
    p_level: filters.level,
    p_track: filters.track || null,
    p_include_other_admission_tracks: filters.allTracks,
    p_institution_id: orNull(filters.universityId),
    p_admission_unit_id: orNull(filters.admissionUnitId),
  });

  if (error) throw error;
  if (!Array.isArray(data)) return [];

  const papers: QuestionBankPaper[] = [];

  for (const raw of data) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    if (typeof row.paper_key !== 'string' || !row.paper_key) continue;

    const count =
      typeof row.question_count === 'number'
        ? row.question_count
        : Number(row.question_count);
    if (!Number.isFinite(count) || count <= 0) continue;

    papers.push({
      key: row.paper_key,
      year:
        typeof row.exam_year === 'string' && row.exam_year
          ? row.exam_year
          : row.paper_key,
      shift: typeof row.shift === 'string' && row.shift ? row.shift : null,
      paperSet:
        typeof row.paper_set === 'string' && row.paper_set ? row.paper_set : null,
      count,
    });
  }

  return papers;
}
