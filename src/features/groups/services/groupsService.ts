import { apiClient } from '@/shared/lib/apiClient';
import type {
  ApiResponse,
  BattleDetailData,
  BattleQuestionsData,
  BattlesData,
  BattleSubmitResult,
  DiscoverGroupsData,
  Group,
  GroupDetailData,
  GroupPreview,
  GroupLeaderboardData,
  GroupsConfig,
  LeaderboardPeriod,
  MessagesData,
  MyGroupsData,
} from '../types';

const unwrap = <T>(response: { data: ApiResponse<T> }): T => response.data.data;

export const groupsService = {
  getConfig: async (): Promise<GroupsConfig> =>
    unwrap(await apiClient.get<ApiResponse<GroupsConfig>>('/groups/config')),

  getMyGroups: async (): Promise<MyGroupsData> =>
    unwrap(await apiClient.get<ApiResponse<MyGroupsData>>('/groups/me')),

  discover: async (params: {
    type?: 'squad' | 'community';
    q?: string;
    page?: number;
    pageSize?: number;
  }): Promise<DiscoverGroupsData> =>
    unwrap(await apiClient.get<ApiResponse<DiscoverGroupsData>>('/groups/discover', { params })),

  createGroup: async (payload: {
    name: string;
    icon?: string | null;
    description?: string | null;
    groupType?: 'squad' | 'community';
    maxMembers?: number;
    visibility?: 'public' | 'code' | 'approval';
    slug?: string;
  }): Promise<{ id: string; group: Group }> =>
    unwrap(await apiClient.post<ApiResponse<{ id: string; group: Group }>>('/groups', payload)),

  joinGroup: async (groupId: string, joinCode?: string): Promise<{ result: string }> =>
    unwrap(
      await apiClient.post<ApiResponse<{ result: string }>>('/groups/join', {
        groupId,
        ...(joinCode ? { joinCode } : {}),
      })
    ),

  joinByCode: async (joinCode: string): Promise<{ result: string }> =>
    unwrap(
      await apiClient.post<ApiResponse<{ result: string }>>('/groups/join-by-code', {
        joinCode,
      })
    ),

  leaveGroup: async (groupId: string): Promise<{ left: boolean }> =>
    unwrap(
      await apiClient.post<ApiResponse<{ left: boolean }>>(`/groups/${groupId}/leave`)
    ),

  getGroup: async (groupIdOrSlug: string): Promise<GroupDetailData> =>
    unwrap(
      await apiClient.get<ApiResponse<GroupDetailData>>(`/groups/${groupIdOrSlug}`)
    ),

  getPreview: async (groupIdOrSlug: string): Promise<{ preview: GroupPreview }> =>
    unwrap(
      await apiClient.get<ApiResponse<{ preview: GroupPreview }>>(
        `/groups/preview/${groupIdOrSlug}`
      )
    ),

  updateGroup: async (
    groupId: string,
    payload: {
      name?: string;
      icon?: string | null;
      description?: string | null;
      visibility?: 'public' | 'code' | 'approval';
      slug?: string;
      maxMembers?: number;
      regenerateJoinCode?: boolean;
      disband?: boolean;
    }
  ): Promise<{ group: Group }> =>
    unwrap(
      await apiClient.patch<ApiResponse<{ group: Group }>>(`/groups/${groupId}`, payload)
    ),

  getJoinCode: async (groupId: string): Promise<{ joinCode: string }> =>
    unwrap(
      await apiClient.get<ApiResponse<{ joinCode: string }>>(`/groups/${groupId}/join-code`)
    ),

  getJoinRequests: async (
    groupId: string
  ): Promise<{ requests: GroupDetailData['members'] }> =>
    unwrap(
      await apiClient.get<ApiResponse<{ requests: GroupDetailData['members'] }>>(
        `/groups/${groupId}/requests`
      )
    ),

  reviewJoinRequest: async (
    groupId: string,
    userId: string,
    approve: boolean
  ): Promise<{ result: string }> =>
    unwrap(
      await apiClient.post<ApiResponse<{ result: string }>>(
        `/groups/${groupId}/requests/${userId}`,
        { approve }
      )
    ),

  kickMember: async (
    groupId: string,
    userId: string,
    banHours?: number | null
  ): Promise<{ kicked: boolean }> =>
    unwrap(
      await apiClient.post<ApiResponse<{ kicked: boolean }>>(
        `/groups/${groupId}/members/${userId}/kick`,
        banHours ? { banHours } : {}
      )
    ),

  getLeaderboard: async (params: {
    period: LeaderboardPeriod;
    page?: number;
    pageSize?: number;
  }): Promise<GroupLeaderboardData> =>
    unwrap(
      await apiClient.get<ApiResponse<GroupLeaderboardData>>('/groups/leaderboard', {
        params,
      })
    ),

  getMessages: async (
    groupId: string,
    params: { before?: string; limit?: number }
  ): Promise<MessagesData> =>
    unwrap(
      await apiClient.get<ApiResponse<MessagesData>>(`/groups/${groupId}/messages`, {
        params,
      })
    ),

  postMessage: async (
    groupId: string,
    content: string,
    messageType: 'text' | 'emoji' | 'question_share' = 'text',
    replyToId?: string | null
  ): Promise<{ message: MessagesData['messages'][number] }> =>
    unwrap(
      await apiClient.post<ApiResponse<{ message: MessagesData['messages'][number] }>>(
        `/groups/${groupId}/messages`,
        { content, messageType, ...(replyToId ? { replyToId } : {}) }
      )
    ),

  deleteMessage: async (groupId: string, messageId: string): Promise<{ deleted: boolean }> =>
    unwrap(
      await apiClient.delete<ApiResponse<{ deleted: boolean }>>(
        `/groups/${groupId}/messages/${messageId}`
      )
    ),

  reportMessage: async (
    groupId: string,
    messageId: string,
    offenseType: 'Profanity' | 'Spam' | 'Harassment' | 'Other',
    reason?: string | null
  ): Promise<{ reported: boolean }> =>
    unwrap(
      await apiClient.post<ApiResponse<{ reported: boolean }>>(
        `/groups/${groupId}/messages/${messageId}/report`,
        { offenseType, reason: reason?.trim() || null }
      )
    ),

  createBattle: async (
    groupId: string,
    payload: {
      title: string;
      subjectId?: string | null;
      chapterId?: string | null;
      questionCount: number;
      durationMinutes: number;
      startTime?: string | null;
    }
  ): Promise<{ id: string; battle: unknown }> =>
    unwrap(
      await apiClient.post<ApiResponse<{ id: string; battle: unknown }>>(
        `/groups/${groupId}/battles`,
        payload
      )
    ),

  listBattles: async (groupId: string): Promise<BattlesData> =>
    unwrap(await apiClient.get<ApiResponse<BattlesData>>(`/groups/${groupId}/battles`)),

  getBattle: async (battleId: string): Promise<BattleDetailData> =>
    unwrap(await apiClient.get<ApiResponse<BattleDetailData>>(`/battles/${battleId}`)),

  joinBattle: async (battleId: string): Promise<{ battle_id: string }> =>
    unwrap(
      await apiClient.post<ApiResponse<{ battle_id: string }>>(`/battles/${battleId}/join`)
    ),

  getBattleQuestions: async (battleId: string): Promise<BattleQuestionsData> =>
    unwrap(
      await apiClient.get<ApiResponse<BattleQuestionsData>>(`/battles/${battleId}/questions`)
    ),

  submitBattle: async (
    battleId: string,
    answers: Record<string, string>
  ): Promise<BattleSubmitResult> =>
    unwrap(
      await apiClient.post<ApiResponse<BattleSubmitResult>>(`/battles/${battleId}/submit`, {
        answers,
      })
    ),

  cancelBattle: async (battleId: string): Promise<{ cancelled: boolean }> =>
    unwrap(
      await apiClient.post<ApiResponse<{ cancelled: boolean }>>(`/battles/${battleId}/cancel`)
    ),

  finalizeBattle: async (battleId: string): Promise<{ snapshot: unknown }> =>
    unwrap(
      await apiClient.post<ApiResponse<{ snapshot: unknown }>>(`/battles/${battleId}/finalize`)
    ),
};
