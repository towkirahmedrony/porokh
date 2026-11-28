import { supabase } from '@/shared/lib/supabase';

/**
 * The past papers of one admission unit, exactly as the admission screen knows
 * them: the paper's own title, its printed duration and its negative marking,
 * with how many questions an attempt could serve. The question bank lists the
 * same rows so a student sees one paper, not one year it happens to belong to.
 */
export interface QuestionBankUnitPaper {
  id: string;
  title: string;
  /** Session label ("2025-26"); null when neither metadata nor title states one. */
  year: string | null;
  durationMin: number | null;
  negativeMarks: number | null;
  count: number;
}

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

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
};

export async function fetchUnitPapers(
  unitId: string
): Promise<QuestionBankUnitPaper[]> {
  if (!unitId) return [];

  const { data, error } = await paperRpc.rpc('get_question_bank_papers', {
    p_level: 'admission',
    p_track: null,
    p_include_other_admission_tracks: true,
    p_institution_id: null,
    p_admission_unit_id: unitId,
  });

  if (error) throw error;
  if (!Array.isArray(data)) return [];

  const papers: QuestionBankUnitPaper[] = [];

  for (const raw of data) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;

    const id = typeof row.paper_id === 'string' ? row.paper_id : '';
    const title = typeof row.title === 'string' ? row.title : '';
    const count = toNumber(row.question_count);

    if (!id || !title || count === null || count <= 0) continue;

    papers.push({
      id,
      title,
      year: typeof row.exam_year === 'string' && row.exam_year ? row.exam_year : null,
      durationMin: toNumber(row.duration_min),
      negativeMarks: toNumber(row.negative_marks),
      count,
    });
  }

  return papers;
}
