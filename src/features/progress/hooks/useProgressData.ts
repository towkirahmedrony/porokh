import { useQuery } from '@tanstack/react-query';
import { fetchProgressDashboardData } from '../services/progressService';
import { ProgressDashboardResponse } from '../types/progress';

const PROGRESS_DASHBOARD_QUERY_KEY = ['progressDashboard'] as const;
const FIVE_MINUTES = 1000 * 60 * 5;
const TWELVE_HOURS = 1000 * 60 * 60 * 12;

export const useProgressData = () => {
  return useQuery<ProgressDashboardResponse, Error>({
    queryKey: PROGRESS_DASHBOARD_QUERY_KEY,
    queryFn: fetchProgressDashboardData,
    staleTime: FIVE_MINUTES,
    gcTime: TWELVE_HOURS,
    retry: 1,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
};
