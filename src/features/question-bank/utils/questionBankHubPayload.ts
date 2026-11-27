import type { StudyGoal, StudyStage } from '@/shared/lib/academic';
import type {
  QuestionBankHubMode,
  QuestionBankHubPayload,
  QuestionBankHubRow,
  QuestionBankHubSection,
} from '../types/questionBankHub';
import type { QuestionBankTrack } from '../types/questionBank';

/**
 * Field-by-field validation of the hub payload.
 *
 * The function is new, so the generated database types have no entry for it and
 * a cast would be a guess. Unknown sections and rows are dropped rather than
 * rendered, which turns a changed shape into a missing section instead of a
 * crash on a phone.
 */

const STAGES: StudyStage[] = ['studying', 'post_hsc', 'admission_prep'];
const GOALS: StudyGoal[] = ['hsc', 'varsity', 'medical', 'engineering'];
const TRACKS: QuestionBankTrack[] = ['varsity', 'medical', 'engineering'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readCount = (value: unknown): number | null => {
  const count = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : null;
};

const readString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const parseRow = (raw: unknown): QuestionBankHubRow | null => {
  if (!isRecord(raw)) return null;

  const id = readString(raw.id);
  const labelBn = readString(raw.label_bn);
  const count = readCount(raw.count);
  if (!id || !labelBn || count === null) return null;

  return {
    id,
    labelBn,
    labelEn: readString(raw.label_en),
    shortName: readString(raw.short_name),
    count,
  };
};

const parseRows = (raw: unknown): QuestionBankHubRow[] =>
  Array.isArray(raw) ? raw.map(parseRow).filter((row): row is QuestionBankHubRow => row !== null) : [];

const parseSection = (raw: unknown): QuestionBankHubSection | null => {
  if (!isRecord(raw)) return null;

  switch (raw.kind) {
    case 'hsc_subjects':
      return { kind: 'hsc_subjects', rows: parseRows(raw.rows) };
    case 'hsc_boards':
      return { kind: 'hsc_boards', rows: parseRows(raw.rows) };
    case 'hsc_colleges':
      return { kind: 'hsc_colleges', rows: parseRows(raw.rows) };
    case 'all_admission': {
      const count = readCount(raw.count);
      return count === null ? null : { kind: 'all_admission', count };
    }
    case 'track': {
      const track = TRACKS.find((value) => value === raw.track);
      const count = readCount(raw.count);
      if (!track || count === null) return null;

      const universities = parseRows(raw.universities);
      return {
        kind: 'track',
        track,
        count,
        primary: raw.primary === true,
        universities,
        universityTotal: readCount(raw.university_total) ?? universities.length,
        subjects: parseRows(raw.subjects),
      };
    }
    default:
      return null;
  }
};

export function parseQuestionBankHubPayload(raw: unknown): QuestionBankHubPayload {
  if (!isRecord(raw)) {
    return { stage: null, goal: null, mode: null, sections: [] };
  }

  const stage = STAGES.find((value) => value === raw.stage) ?? null;
  const goal = GOALS.find((value) => value === raw.goal) ?? null;
  const mode: QuestionBankHubMode | null =
    raw.mode === 'hsc' || raw.mode === 'admission' ? raw.mode : null;

  const sections = Array.isArray(raw.sections)
    ? raw.sections
        .map(parseSection)
        .filter((section): section is QuestionBankHubSection => section !== null)
    : [];

  return { stage, goal, mode, sections };
}

