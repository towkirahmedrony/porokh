import apiClient from '@/shared/lib/apiClient';
import { supabase } from '@/shared/lib/supabase';
import {
  MODEL_TRACKS,
  isModelTrack,
  type ModelPaperScope,
  type ModelTrack,
} from '../constants/modelTracks';

export interface ModelPaperSubject {
  name_bn: string | null;
  name_en: string | null;
  slug: string | null;
}

export interface ModelPaper {
  id: string;
  title: string;
  title_en: string | null;
  subject_id: string | null;
  category: string | null;
  track: string | null;
  is_premium: boolean | null;
  duration_min: number | null;
  total_marks: number | null;
  default_negative_marks: number | null;
  start_time: string | null;
  end_time: string | null;
  instructions: string | null;
  instructions_en: string | null;
  syllabus_details: string | null;
  syllabus_details_en: string | null;
  created_at: string | null;
  subjects?: ModelPaperSubject | null;
}

export interface ModelPaperListItem extends ModelPaper {
  question_count: number | null;
}

export type ModelPaperAvailability = 'available' | 'not-started' | 'closed';

export interface ModelAttemptStart {
  id: string;
  exam_id: string | null;
}

const MODEL_PAPER_SELECT = `
  id,
  title,
  title_en,
  subject_id,
  category,
  track,
  is_premium,
  duration_min,
  total_marks,
  default_negative_marks,
  start_time,
  end_time,
  instructions,
  instructions_en,
  syllabus_details,
  syllabus_details_en,
  created_at,
  subjects:subject_id (
    name_bn,
    name_en,
    slug
  )
`;

export interface ModelSubjectSummary {
  id: string;
  slug: string | null;
  name_bn: string | null;
  name_en: string | null;
  icon_url: string | null;
  paperCount: number;
}

export interface ModelTrackSummary {
  paperCount: number;
  fullCount: number;
  subjects: ModelSubjectSummary[];
}

export type ModelTrackSummaryMap = Record<ModelTrack, ModelTrackSummary>;

interface ModelSummaryRow {
  id: string;
  track: string | null;
  subject_id: string | null;
  subjects: {
    slug: string | null;
    name_bn: string | null;
    name_en: string | null;
    icon_url: string | null;
    sequence: number | null;
  } | null;
}

const MODEL_SUMMARY_SELECT =
  'id, track, subject_id, subjects:subject_id ( slug, name_bn, name_en, icon_url, sequence )';

const COUNT_CHUNK_SIZE = 200;

const timeValue = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

export const getModelPaperAvailability = (
  paper: Pick<ModelPaper, 'start_time' | 'end_time'>,
  now: number = Date.now()
): ModelPaperAvailability => {
  const start = timeValue(paper.start_time);
  if (start !== null && now < start) return 'not-started';

  const end = timeValue(paper.end_time);
  if (end !== null && now > end) return 'closed';

  return 'available';
};

async function fetchQuestionCounts(examIds: string[]): Promise<Map<string, number>> {
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
    if (result.error || !result.data) continue;

    for (const row of result.data) {
      if (!row.exam_id) continue;
      counts.set(row.exam_id, (counts.get(row.exam_id) ?? 0) + 1);
    }
  }

  return counts;
}

const unwrap = <T>(payload: unknown): T => {
  const envelope = payload as { data?: T } | null;
  if (envelope && typeof envelope === 'object' && 'data' in envelope && envelope.data) {
    return envelope.data;
  }
  return payload as T;
};

export const modelPaperService = {
  async getPapers({
    track,
    scope,
    subjectId,
  }: {
    track: ModelTrack;
    scope: ModelPaperScope;
    subjectId?: string | null;
  }): Promise<ModelPaperListItem[]> {
    if (scope === 'subject' && !subjectId) return [];

    let query = supabase
      .from('exam_papers')
      .select(MODEL_PAPER_SELECT)
      .eq('category', 'model_test')
      .eq('track', track)
      .eq('is_published', true);

    query =
      scope === 'full'
        ? query.is('subject_id', null)
        : query.eq('subject_id', subjectId as string);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    const papers = (data ?? []) as unknown as ModelPaper[];
    const counts = await fetchQuestionCounts(papers.map((paper) => paper.id));

    return papers.map((paper) => ({
      ...paper,
      question_count: counts.get(paper.id) ?? null,
    }));
  },

  async getTrackSummary(): Promise<ModelTrackSummaryMap> {
    const { data, error } = await supabase
      .from('exam_papers')
      .select(MODEL_SUMMARY_SELECT)
      .eq('category', 'model_test')
      .eq('is_published', true);

    if (error) throw new Error(error.message);

    const rows = (data ?? []) as unknown as ModelSummaryRow[];
    const summary = Object.fromEntries(
      MODEL_TRACKS.map((track) => [
        track,
        { paperCount: 0, fullCount: 0, subjects: [] as ModelSubjectSummary[] },
      ])
    ) as ModelTrackSummaryMap;
    const sequences = new Map<string, number>();

    for (const row of rows) {
      if (!isModelTrack(row.track)) continue;

      const entry = summary[row.track];
      entry.paperCount += 1;

      if (!row.subject_id) {
        entry.fullCount += 1;
        continue;
      }

      let item = entry.subjects.find((subject) => subject.id === row.subject_id);
      if (!item) {
        item = {
          id: row.subject_id,
          slug: row.subjects?.slug ?? null,
          name_bn: row.subjects?.name_bn ?? null,
          name_en: row.subjects?.name_en ?? null,
          icon_url: row.subjects?.icon_url ?? null,
          paperCount: 0,
        };
        entry.subjects.push(item);
        sequences.set(row.subject_id, row.subjects?.sequence ?? 9999);
      }
      item.paperCount += 1;
    }

    for (const track of MODEL_TRACKS) {
      summary[track].subjects.sort(
        (a, b) => (sequences.get(a.id) ?? 9999) - (sequences.get(b.id) ?? 9999)
      );
    }

    return summary;
  },

  async startAttempt(examId: string): Promise<ModelAttemptStart> {
    const response = await apiClient.post('/exams/user/attempts/start', {
      exam_id: examId,
    });

    const attempt = unwrap<ModelAttemptStart>(response.data);

    if (!attempt?.id) {
      throw new Error('The server did not return an attempt id.');
    }

    return attempt;
  },
};
