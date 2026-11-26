import type { StudyGoal, StudyStage } from '@/shared/lib/academic';

/** Exactly what `get_my_stage()` returns, computed by the server. */
export interface StageResponse {
  stage: StudyStage;
  batch_year: string | null;
  goal: StudyGoal | null;
  needs_goal_gate: boolean;
  exam_ended: boolean;
}

export type StageStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface StageState {
  stage: StudyStage | null;
  batchYear: string | null;
  goal: StudyGoal | null;
  needsGoalGate: boolean;
  examEnded: boolean;
  status: StageStatus;
}

export interface StageContextValue extends StageState {
  /** Re-reads the stage from the server. Safe to call on every resume. */
  refresh: () => Promise<void>;
  /** Records an explicit goal and adopts the stage the server returns. */
  setGoal: (goal: StudyGoal) => Promise<void>;
}
