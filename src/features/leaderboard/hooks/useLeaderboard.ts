import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/lib/apiClient';
import { LeaderboardUser, League } from '../types/leaderboard';
import { GroupLeaderboardResponse } from '../types/groupLeaderboard';

// Best Practice: Centralized Query Keys factory
export const LEADERBOARD_QUERY_KEYS = {
  all: ['leaderboard'] as const,
  // maxXp এখন null হতে পারে (১০ম লেভেলের জন্য)
  league: (minXp: number, maxXp: number | null) => [...LEADERBOARD_QUERY_KEYS.all, 'league', minXp, maxXp] as const,
  squads: () => [...LEADERBOARD_QUERY_KEYS.all, 'squads'] as const,
  leaguesConfig: () => [...LEADERBOARD_QUERY_KEYS.all, 'leagues-config'] as const,
};

interface ApiResponse<T> {
  data: T;
  message?: string;
}

export const useLeaguesConfig = () => {
  return useQuery<League[]>({
    queryKey: LEADERBOARD_QUERY_KEYS.leaguesConfig(),
    queryFn: async () => {
      // URL আপডেট করা হয়েছে: /leaderboard/leagues থেকে /app-builder/levels
      const response = await apiClient.get<ApiResponse<League[]>>('/app-builder/levels');
      // Sort by min_xp ensuring consistent order
      return (response.data.data || []).sort((a, b) => a.min_xp - b.min_xp);
    },
    staleTime: 1000 * 60 * 60 * 24, // Config remains fresh for 24 hours
    refetchOnWindowFocus: false,
  });
};

export const useLeaderboard = (minXp: number, maxXp: number | null, enabled: boolean = true) => {
  return useQuery<LeaderboardUser[]>({
    queryKey: LEADERBOARD_QUERY_KEYS.league(minXp, maxXp),
    queryFn: async () => {
      // Added strict typing to apiClient.get
      const response = await apiClient.get<ApiResponse<LeaderboardUser[]>>('/leaderboard/league', {
        params: { min_xp: minXp, max_xp: maxXp }
      });
      return response.data.data;
    },
    // Prevent excessive refetching of leaderboard data
    staleTime: 1000 * 60, // Data remains fresh for 1 minute
    refetchOnWindowFocus: false, // Don't refetch just because user switched tabs
    enabled: enabled, // Prevents fetching before leagues are fully loaded
  });
};

export const useSquadLeaderboard = () => {
  return useQuery<GroupLeaderboardResponse>({
    queryKey: LEADERBOARD_QUERY_KEYS.squads(),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<GroupLeaderboardResponse>>('/leaderboard/squads');
      const data = response.data.data;

      // Data Normalization: Smooth out backend casing inconsistencies right at the source
      if (data.myGroup && !data.my_group) {
        data.my_group = data.myGroup;
      }

      return data;
    },
    staleTime: 1000 * 60, // 1 minute
    refetchOnWindowFocus: false,
  });
};
