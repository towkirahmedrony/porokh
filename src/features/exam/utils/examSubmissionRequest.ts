import type { AxiosResponse } from 'axios';
import apiClient from '@/shared/lib/apiClient';
import {
  createSubmissionRequestId,
  recordSubmissionHttpMeasure,
} from './examSubmissionRequestTelemetry';

/**
 * All exam submit paths use this wrapper so each actual HTTP attempt has its
 * own request ID and an ID-keyed browser performance entry. No payload or
 * answer values are copied into telemetry or logs.
 */
export const postExamSubmission = async <T = any>(payload: unknown): Promise<AxiosResponse<T>> => {
  const requestId = createSubmissionRequestId();
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

  try {
    return await apiClient.post<T>('/exams/user/submit', payload, {
      headers: { 'x-request-id': requestId },
    });
  } finally {
    recordSubmissionHttpMeasure(requestId, startedAt);
  }
};
