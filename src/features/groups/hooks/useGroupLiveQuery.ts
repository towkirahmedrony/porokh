import { useQuery } from '@tanstack/react-query';

type GroupLiveQueryOptions<T> = {
  queryKey: readonly unknown[];
  queryFn: () => Promise<T>;
  enabled?: boolean;
  pollMs: number;
  staleTime?: number;
};

/**
 * Single polling abstraction for group chat and battle lobby/status.
 *
 * Realtime is not enabled on these tables yet. Keeping every live screen on
 * this hook means swapping it for a Supabase Realtime subscription later is a
 * one-file change. Polling pauses while the tab is hidden.
 */
export const useGroupLiveQuery = <T>({
  queryKey,
  queryFn,
  enabled = true,
  pollMs,
  staleTime = 0,
}: GroupLiveQueryOptions<T>) => {
  return useQuery<T>({
    queryKey,
    queryFn,
    enabled,
    staleTime,
    refetchOnWindowFocus: true,
    refetchInterval: () => {
      if (typeof document !== 'undefined' && document.hidden) return false;
      return pollMs;
    },
  });
};
