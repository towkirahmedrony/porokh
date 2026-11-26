import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/shared/lib/supabase';

export const hscBatchesQueryKey = ['hsc-batches'] as const;

interface HscBatchQueryState {
  batches: string[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * The batches a student can belong to. The list is admin-owned data, so it is
 * read rather than hardcoded: adding next year's batch is an admin action, not
 * an app release. Newest first, which is the order the picker shows.
 */
export const useHscBatches = (): HscBatchQueryState => {
  const query = useQuery({
    queryKey: hscBatchesQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hsc_batches')
        .select('batch_year')
        .order('batch_year', { ascending: false });

      if (error) throw new Error(error.message);

      return (data ?? []).map((row) => row.batch_year);
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    batches: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => {
      void query.refetch();
    },
  };
};
