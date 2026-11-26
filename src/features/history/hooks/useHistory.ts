import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { getExamHistory } from '../services/historyService';

/**
 * The attempts list for the History tab. Mistakes and Bookmarks are served by
 * the explorer (ids first, bodies for the visible page only), so this hook no
 * longer downloads either of those lists.
 */
export const useHistory = () => {
  const { user } = useAuth();

  // The cache is persisted for offline use, so it must be scoped to the signed
  // in student: a second user on the same device must never read the first
  // user's attempts from the cache.
  const userId = user?.id ?? 'anonymous';

  const {
    data: historyData = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['history', 'exams', userId],
    queryFn: getExamHistory,
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return { isLoading, isError, refetch, historyData };
};

export default useHistory;
