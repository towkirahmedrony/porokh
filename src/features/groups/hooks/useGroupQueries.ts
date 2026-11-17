import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { groupsService } from '../services/groupsService';
import type { LeaderboardPeriod } from '../types';
import { useGroupLiveQuery } from './useGroupLiveQuery';

export const GROUP_QUERY_KEYS = {
  all: ['groups'] as const,
  config: () => [...GROUP_QUERY_KEYS.all, 'config'] as const,
  me: () => [...GROUP_QUERY_KEYS.all, 'me'] as const,
  discover: (params: { type?: string; q?: string; page?: number }) =>
    [...GROUP_QUERY_KEYS.all, 'discover', params] as const,
  detail: (groupId: string) => [...GROUP_QUERY_KEYS.all, 'detail', groupId] as const,
  leaderboard: (period: LeaderboardPeriod) =>
    [...GROUP_QUERY_KEYS.all, 'leaderboard', period] as const,
  messages: (groupId: string) => [...GROUP_QUERY_KEYS.all, 'messages', groupId] as const,
  battles: (groupId: string) => [...GROUP_QUERY_KEYS.all, 'battles', groupId] as const,
  battle: (battleId: string) => [...GROUP_QUERY_KEYS.all, 'battle', battleId] as const,
  battleQuestions: (battleId: string) =>
    [...GROUP_QUERY_KEYS.all, 'battle-questions', battleId] as const,
};

export const useGroupsConfig = () =>
  useQuery({
    queryKey: GROUP_QUERY_KEYS.config(),
    queryFn: groupsService.getConfig,
    staleTime: 1000 * 60 * 30,
  });

export const useMyGroups = () =>
  useQuery({
    queryKey: GROUP_QUERY_KEYS.me(),
    queryFn: groupsService.getMyGroups,
    staleTime: 1000 * 30,
  });

export const useDiscoverGroups = (params: {
  type?: 'squad' | 'community';
  q?: string;
  page?: number;
}) =>
  useQuery({
    queryKey: GROUP_QUERY_KEYS.discover(params),
    queryFn: () => groupsService.discover(params),
    staleTime: 1000 * 30,
  });

export const useGroupDetail = (groupId: string | undefined) =>
  useQuery({
    queryKey: GROUP_QUERY_KEYS.detail(groupId ?? ''),
    queryFn: () => groupsService.getGroup(groupId as string),
    enabled: Boolean(groupId),
    staleTime: 1000 * 20,
  });

export const useGroupLeaderboard = (period: LeaderboardPeriod) =>
  useInfiniteQuery({
    queryKey: GROUP_QUERY_KEYS.leaderboard(period),
    queryFn: ({ pageParam }) =>
      groupsService.getLeaderboard({ period, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    staleTime: 1000 * 60,
  });

export const useGroupMessages = (groupId: string | undefined) =>
  useGroupLiveQuery({
    queryKey: GROUP_QUERY_KEYS.messages(groupId ?? ''),
    queryFn: () => groupsService.getMessages(groupId as string, { limit: 30 }),
    enabled: Boolean(groupId),
    pollMs: 4000,
  });

export const useGroupBattles = (groupId: string | undefined) =>
  useGroupLiveQuery({
    queryKey: GROUP_QUERY_KEYS.battles(groupId ?? ''),
    queryFn: () => groupsService.listBattles(groupId as string),
    enabled: Boolean(groupId),
    pollMs: 4000,
  });

export const useBattleDetail = (battleId: string | undefined) =>
  useGroupLiveQuery({
    queryKey: GROUP_QUERY_KEYS.battle(battleId ?? ''),
    queryFn: () => groupsService.getBattle(battleId as string),
    enabled: Boolean(battleId),
    pollMs: 4000,
  });

export const useBattleQuestions = (battleId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: GROUP_QUERY_KEYS.battleQuestions(battleId ?? ''),
    queryFn: () => groupsService.getBattleQuestions(battleId as string),
    enabled: Boolean(battleId) && enabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 0,
  });
