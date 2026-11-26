import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { homeExamService, type HomeExamTrack } from '../services/homeExamService';
import type { ModelPaperListItem } from '@/features/exam/services/modelPaperService';

const EMPTY_PAPERS: ModelPaperListItem[] = [];
const TIMED_STALE_TIME = 60 * 1000;
const MODEL_TEST_STALE_TIME = 5 * 60 * 1000;

/**
 * Both Home exam sections share one query key root so the target switch can
 * refresh them together, while each read keeps its own cache entry and runs in
 * parallel with the other.
 */
export const useHomeExams = (track: HomeExamTrack | null) => {
  const enabled = track !== null;

  const timedQuery = useQuery({
    queryKey: ['home-exams', 'timed', track ?? 'none'],
    queryFn: () => (track ? homeExamService.getTimedPapers(track) : EMPTY_PAPERS),
    enabled,
    staleTime: TIMED_STALE_TIME,
    gcTime: 10 * 60 * 1000,
    // New papers are published and windows open while the screen is open.
    refetchInterval: TIMED_STALE_TIME,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const modelTestsQuery = useQuery({
    queryKey: ['home-exams', 'model-tests', track ?? 'none'],
    queryFn: () => (track ? homeExamService.getModelTests(track) : EMPTY_PAPERS),
    enabled,
    staleTime: MODEL_TEST_STALE_TIME,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const refetch = useCallback(async () => {
    await Promise.all([timedQuery.refetch(), modelTestsQuery.refetch()]);
  }, [timedQuery.refetch, modelTestsQuery.refetch]);

  return {
    timedPapers: timedQuery.data ?? EMPTY_PAPERS,
    modelTests: modelTestsQuery.data ?? EMPTY_PAPERS,
    isLoading: timedQuery.isLoading || modelTestsQuery.isLoading,
    timedError: timedQuery.isError,
    modelTestsError: modelTestsQuery.isError,
    refetch,
  };
};
