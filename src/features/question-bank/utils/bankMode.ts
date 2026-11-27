import type { StudyGoal, StudyStage } from '@/shared/lib/academic';
import type { StageStatus } from '@/features/stage/types/stage';

/**
 * Which question bank a student gets.
 *
 * The decision is a pure function of the server's stage, never of a date. A
 * student who has finished HSC and chosen a goal is not doing concept revision
 * any more, so their bank has no HSC content at all and no switch to reach it.
 * A student still studying keeps both, because the bank is how they revise.
 */

export type BankMode = 'hsc' | 'admission' | 'neutral';

export type AdmissionTrack = 'varsity' | 'medical' | 'engineering';

export interface BankModeInput {
  stage: StudyStage | null;
  goal: StudyGoal | null;
  status: StageStatus;
}

export interface BankModeResult {
  mode: BankMode;
  /** Whether the student may move between the HSC and admission tabs. */
  canSwitchLevel: boolean;
  /** Track the admission bank opens on. Null means every admission track. */
  defaultTrack: AdmissionTrack | null;
}

const NEUTRAL: BankModeResult = {
  mode: 'neutral',
  canSwitchLevel: false,
  defaultTrack: null,
};

/** Only the three goal-specific tracks default a bank; 'hsc' and null do not. */
export const asAdmissionTrack = (goal: StudyGoal | null): AdmissionTrack | null => {
  if (goal === 'varsity' || goal === 'medical' || goal === 'engineering') {
    return goal;
  }
  return null;
};

export const resolveBankMode = ({
  stage,
  goal,
  status,
}: BankModeInput): BankModeResult => {
  // Anything other than a complete server answer shows the neutral skeleton.
  // A half-known stage must never guess a level and paint the wrong content.
  if (status !== 'ready' || stage === null) return NEUTRAL;

  if (stage === 'studying') {
    return { mode: 'hsc', canSwitchLevel: true, defaultTrack: asAdmissionTrack(goal) };
  }

  if (stage === 'admission_prep') {
    return {
      mode: 'admission',
      // Without a goal the student sees every admission track, which is still
      // admission level, so the goal chip is available either way.
      defaultTrack: asAdmissionTrack(goal),
      canSwitchLevel: false,
    };
  }

  // post_hsc is redirected to the goal gate before it reaches the bank.
  return NEUTRAL;
};

/** The bank's default tab once the student has chosen one this session. */
export const resolveInitialLevel = (
  result: BankModeResult,
  storedLevel: 'hsc' | 'admission' | null
): 'hsc' | 'admission' | null => {
  if (result.mode === 'neutral') return null;
  if (result.mode === 'admission') return 'admission';
  if (storedLevel === 'admission') return 'admission';
  return 'hsc';
};

/**
 * A goal with no questions yet still needs a screen. The caller renders the
 * "questions coming soon" state instead of an empty list, and this is the flag
 * that says so.
 *
 * `hasLoaded` is required on purpose. A pending or failed request also reports
 * zero rows, and claiming "this track has no questions" from that is how a
 * broken query used to look like a content decision.
 */
export const needsGoalEmptyState = (
  result: BankModeResult,
  level: 'hsc' | 'admission' | null,
  totalForTrack: number,
  includesAllTracks: boolean,
  hasLoaded: boolean
): boolean =>
  hasLoaded &&
  result.mode === 'admission' &&
  level === 'admission' &&
  !includesAllTracks &&
  result.defaultTrack !== null &&
  totalForTrack === 0;
