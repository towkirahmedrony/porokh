import { supabase } from '@/shared/lib/supabase';
import {
  MODEL_PAPER_SELECT,
  fetchQuestionCounts,
  type ModelPaper,
  type ModelPaperListItem,
} from '@/features/exam/services/modelPaperService';

export const HOME_EXAM_TRACKS = [
  'hsc',
  'medical',
  'engineering',
  'varsity',
] as const;

export type HomeExamTrack = (typeof HOME_EXAM_TRACKS)[number];

export const isHomeExamTrack = (value: unknown): value is HomeExamTrack =>
  typeof value === 'string' &&
  (HOME_EXAM_TRACKS as readonly string[]).includes(value);

const TIMED_PAPER_LIMIT = 20;
const MODEL_TEST_LIMIT = 3;

const withQuestionCounts = async (
  rows: unknown[]
): Promise<ModelPaperListItem[]> => {
  const papers = rows as ModelPaper[];
  const counts = await fetchQuestionCounts(papers.map((paper) => paper.id));

  return papers.map((paper) => ({
    ...paper,
    question_count: counts.get(paper.id) ?? null,
  }));
};

export const homeExamService = {
  /**
   * Published papers for the track whose window is still running or still to
   * come. Papers that already ended are excluded in SQL, and the screen
   * re-checks against its ticker so a finishing exam disappears immediately.
   */
  async getTimedPapers(track: HomeExamTrack): Promise<ModelPaperListItem[]> {
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from('exam_papers')
      .select(MODEL_PAPER_SELECT)
      .eq('track', track)
      .eq('is_published', true)
      .not('start_time', 'is', null)
      .not('end_time', 'is', null)
      .gte('end_time', nowIso)
      .order('start_time', { ascending: true })
      .limit(TIMED_PAPER_LIMIT);

    if (error) throw new Error(error.message);

    return withQuestionCounts(data ?? []);
  },

  /**
   * Full papers only (`subject_id IS NULL`). Varsity content lives in the
   * admission category, so the track is the only filter that works across all
   * four targets.
   */
  async getModelTests(track: HomeExamTrack): Promise<ModelPaperListItem[]> {
    const { data, error } = await supabase
      .from('exam_papers')
      .select(MODEL_PAPER_SELECT)
      .eq('track', track)
      .eq('is_published', true)
      .is('subject_id', null)
      .order('created_at', { ascending: false })
      .limit(MODEL_TEST_LIMIT);

    if (error) throw new Error(error.message);

    return withQuestionCounts(data ?? []);
  },

  // Saving the goal lives in `useStage().setGoal()`: it goes through the API
  // that also stamps `goal_confirmed_at`, which a direct table write cannot.
};
