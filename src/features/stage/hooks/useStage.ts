import { useStageContext } from '../context/StageProvider';
import type { StageContextValue } from '../types/stage';

/**
 * The one place a screen reads the student's stage or goal from.
 *
 * Callers never compute a stage from dates; the server's answer is the only
 * answer, and it is shared by the goal gate, Home, Profile and Progress.
 */
export const useStage = (): StageContextValue => useStageContext();
