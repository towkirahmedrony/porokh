import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toggleBookmark } from '@/features/question-bank/services/questionBankService';
import {
  fetchAdmissionBankAnswers,
  fetchAdmissionBankPage,
  fetchAdmissionHubCatalog,
  fetchAdmissionUnitHub,
} from '../services/admissionHubService';
import type { AdmissionBankFilters } from '../types/admissionHub';

/** Universities and their unit counts for the admission entry grid. */
export const useAdmissionHubCatalog = () =>
  useQuery({
    queryKey: ['admission-hub', 'catalog'],
    queryFn: fetchAdmissionHubCatalog,
    staleTime: 5 * 60 * 1000,
  });

/** One unit hub: papers, model tests and bank facets in a single request. */
export const useAdmissionUnitHub = (
  institutionSlug: string | undefined,
  unitCode: string | undefined
) =>
  useQuery({
    queryKey: ['admission-hub', 'unit', institutionSlug, unitCode],
    queryFn: () =>
      fetchAdmissionUnitHub(institutionSlug ?? '', unitCode ?? ''),
    enabled: Boolean(institutionSlug && unitCode),
    staleTime: 2 * 60 * 1000,
  });

/** Paged, unit-scoped question bank; only fetched while its tab is open. */
export const useAdmissionBank = (
  unitId: string | undefined,
  filters: AdmissionBankFilters,
  enabled: boolean
) =>
  useInfiniteQuery({
    queryKey: ['admission-hub', 'bank', unitId, filters],
    queryFn: ({ pageParam }) =>
      fetchAdmissionBankPage(unitId ?? '', filters, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    enabled: enabled && Boolean(unitId),
    staleTime: 60 * 1000,
  });

/** Answer key is requested only after the student asks to reveal it. */
export const useAdmissionBankAnswers = (
  unitId: string | undefined,
  questionIds: string[],
  enabled: boolean
) =>
  useQuery({
    queryKey: ['admission-hub', 'bank-answers', unitId, questionIds],
    queryFn: () => fetchAdmissionBankAnswers(unitId ?? '', questionIds),
    enabled: enabled && Boolean(unitId) && questionIds.length > 0,
    staleTime: 10 * 60 * 1000,
  });

export const useAdmissionBookmark = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      questionId,
      isBookmarked,
    }: {
      questionId: string;
      isBookmarked: boolean;
    }) => toggleBookmark(questionId, isBookmarked),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admission-hub', 'bank'] }),
        queryClient.invalidateQueries({ queryKey: ['history', 'bookmarks'] }),
      ]);
    },
  });
};
