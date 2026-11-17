import apiClient from '@/shared/lib/apiClient';
import type { HistoryItem } from '../types/history';

/**
 * The history API resolves exam and subject labels server-side in batched
 * queries. Older backend builds may omit them, in which case the presentation
 * layer falls back to the attempt number instead of a generic "Exam" label.
 */
export const getExamHistory = async (): Promise<HistoryItem[]> => {
  const { data: response } = await apiClient.get<{ data: HistoryItem[] }>(
    '/history/exams',
  );

  if (!Array.isArray(response.data)) return [];

  return response.data.map((item) => ({
    ...item,
    retake_available_count: Math.max(
      0,
      Number(item.retake_available_count ?? 0),
    ),
    wrong_available_count: Math.max(
      0,
      Number(item.wrong_available_count ?? 0),
    ),
  }));
};
