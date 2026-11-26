import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { fetchProgressDashboardData } from '../services/progressService';
import { ProgressDashboardResponse } from '../types/progress';

const FIVE_MINUTES = 1000 * 60 * 5;
const TWELVE_HOURS = 1000 * 60 * 60 * 12;

/**
 * The user id is part of the key, so switching accounts can never render the
 * previous account's cached dashboard. Returning to the screen refetches: a
 * finished exam changes every number on the page.
 */
export const useProgressData = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  return useQuery<ProgressDashboardResponse, Error>({
    queryKey: ['progressDashboard', userId],
    queryFn: fetchProgressDashboardData,
    enabled: Boolean(userId),
    staleTime: FIVE_MINUTES,
    gcTime: TWELVE_HOURS,
    retry: 1,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
};
