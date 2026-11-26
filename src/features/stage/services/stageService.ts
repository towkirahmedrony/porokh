import apiClient from '@/shared/lib/apiClient';
import type { StudyGoal } from '@/shared/lib/academic';
import type { StageResponse } from '../types/stage';
import { parseStageResponse } from '../utils/stage';

/** The API wraps every payload in `{ success, message, data }`. */
const readStage = (body: unknown): StageResponse => {
  const envelope = body as { data?: unknown } | null;
  const parsed = parseStageResponse(envelope?.data);

  if (!parsed) throw new Error('Stage response was invalid');

  return parsed;
};

export const stageService = {
  async getStage(): Promise<StageResponse> {
    const { data } = await apiClient.get('/profiles/stage');
    return readStage(data);
  },

  async setGoal(goal: StudyGoal): Promise<StageResponse> {
    const { data } = await apiClient.patch('/profiles/goal', { goal });
    return readStage(data);
  },
};
