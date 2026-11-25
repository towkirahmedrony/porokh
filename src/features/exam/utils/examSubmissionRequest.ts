import type { AxiosResponse } from 'axios';
import apiClient from '@/shared/lib/apiClient';
import { queryClient } from '@/shared/lib/queryClient';
import {
  createSubmissionRequestId,
  recordSubmissionHttpMeasure,
} from './examSubmissionRequestTelemetry';

/**
 * A saved result changes the database-derived streak, the heatmap and the XP
 * inbox row, but those live outside the submit payload. Every submit path
 * (online, offline replay, admission, practice) goes through this wrapper, so
 * the streak screen and the badge catch up without a poll.
 */
const refreshStudyProgress = (): void => {
  void queryClient.invalidateQueries({ queryKey: ['streak', 'stats'] });
  void queryClient.invalidateQueries({ queryKey: ['notifications'] });
};

/**
 * All exam submit paths use this wrapper so each actual HTTP attempt has its
 * own request ID and an ID-keyed browser performance entry. No payload or
 * answer values are copied into telemetry or logs.
 */
export const postExamSubmission = async <T = any>(payload: unknown): Promise<AxiosResponse<T>> => {
  const requestId = createSubmissionRequestId();
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

  try {
    const response = await apiClient.post<T>('/exams/user/submit', payload, {
      headers: { 'x-request-id': requestId },
    });
    refreshStudyProgress();
    return response;
  } finally {
    recordSubmissionHttpMeasure(requestId, startedAt);
  }
};
