import {
  isStudyGoal,
  isStudyStage,
  type StudyGoal,
} from '@/shared/lib/academic';
import type { StageResponse, StageState } from '../types/stage';

export const EMPTY_STAGE_STATE: StageState = {
  stage: null,
  batchYear: null,
  goal: null,
  needsGoalGate: false,
  examEnded: false,
  status: 'idle',
};

/**
 * A stage answer is only usable when it is complete. A half-written payload is
 * rejected rather than half-applied: a missing `needs_goal_gate` must never be
 * read as `false` and let a gated student through.
 */
export const parseStageResponse = (value: unknown): StageResponse | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const raw = value as Record<string, unknown>;

  if (!isStudyStage(raw.stage)) return null;
  if (typeof raw.needs_goal_gate !== 'boolean') return null;
  if (typeof raw.exam_ended !== 'boolean') return null;
  if (raw.batch_year !== null && typeof raw.batch_year !== 'string') return null;
  if (raw.goal !== null && !isStudyGoal(raw.goal)) return null;

  return {
    stage: raw.stage,
    batch_year: (raw.batch_year as string | null) ?? null,
    goal: (raw.goal as StudyGoal | null) ?? null,
    needs_goal_gate: raw.needs_goal_gate,
    exam_ended: raw.exam_ended,
  };
};

export const stageStateFromResponse = (response: StageResponse): StageState => ({
  stage: response.stage,
  batchYear: response.batch_year,
  goal: response.goal,
  needsGoalGate: response.needs_goal_gate,
  examEnded: response.exam_ended,
  status: 'ready',
});

export const stageResponseFromState = (state: StageState): StageResponse | null => {
  if (!state.stage) return null;

  return {
    stage: state.stage,
    batch_year: state.batchYear,
    goal: state.goal,
    needs_goal_gate: state.needsGoalGate,
    exam_ended: state.examEnded,
  };
};

/** A cached answer from a previous launch, or null when the shape is wrong. */
export const readCachedStageState = (value: unknown): StageState | null => {
  const response = parseStageResponse(value);
  return response ? stageStateFromResponse(response) : null;
};
