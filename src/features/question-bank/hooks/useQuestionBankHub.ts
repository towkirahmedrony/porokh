import { useQuery } from '@tanstack/react-query';
import { fetchQuestionBankHub } from '../services/questionBankHubService';
import {
  EMPTY_QUESTION_BANK_HUB,
  type QuestionBankHubMode,
} from '../types/questionBankHub';

/**
 * The hub read, cached per mode.
 *
 * Stale-while-revalidate on purpose: returning from the list must not flash a
 * skeleton over content the student saw a moment ago, while a tab that has been
 * open for a while still refreshes in the background.
 *
 * No request is made until the server's stage has decided a mode. The hub never
 * guesses which bank the student gets.
 */
export function useQuestionBankHub(mode: QuestionBankHubMode | null) {
  const query = useQuery({
    queryKey: ['question-bank', 'hub', mode],
    queryFn: () => fetchQuestionBankHub(mode),
    enabled: mode !== null,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    retry: 1,
  });

  return {
    payload: query.data ?? EMPTY_QUESTION_BANK_HUB,
    /** True only while there is nothing to show for this mode yet. */
    isPending: mode !== null && query.isPending,
    isError: query.isError,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
