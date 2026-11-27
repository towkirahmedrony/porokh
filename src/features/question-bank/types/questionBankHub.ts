import type { StudyGoal, StudyStage } from '@/shared/lib/academic';
import type { QuestionBankTrack } from './questionBank';

/**
 * The Question Bank hub payload, as `get_question_bank_hub` returns it.
 *
 * Every count here is a count over the same row source the list reads, so a
 * number on the hub is the number the list shows after tapping it. The client
 * never recalculates one; it prints what the server counted.
 */

export type QuestionBankHubMode = 'hsc' | 'admission';

/** One tappable row: a subject, a board, a college or a university. */
export interface QuestionBankHubRow {
  id: string;
  labelBn: string;
  labelEn: string | null;
  shortName: string | null;
  count: number;
}

export type QuestionBankHubSection =
  | { kind: 'hsc_subjects'; rows: QuestionBankHubRow[] }
  | { kind: 'hsc_boards'; rows: QuestionBankHubRow[] }
  | { kind: 'hsc_colleges'; rows: QuestionBankHubRow[] }
  | { kind: 'all_admission'; count: number }
  | {
      kind: 'track';
      track: QuestionBankTrack;
      count: number;
      /** The goal's own section: rendered larger, first, and expanded. */
      primary: boolean;
      universities: QuestionBankHubRow[];
      universityTotal: number;
      subjects: QuestionBankHubRow[];
    };

export interface QuestionBankHubPayload {
  stage: StudyStage | null;
  goal: StudyGoal | null;
  mode: QuestionBankHubMode | null;
  sections: QuestionBankHubSection[];
}

export const EMPTY_QUESTION_BANK_HUB: QuestionBankHubPayload = {
  stage: null,
  goal: null,
  mode: null,
  sections: [],
};
