export type GroupType = 'squad' | 'community';
export type GroupVisibility = 'public' | 'code' | 'approval';
export type GroupRole = 'admin' | 'member';
export type MembershipStatus = 'active' | 'invited' | 'pending' | 'left' | 'kicked';
export type BattleState = 'upcoming' | 'live' | 'grading' | 'completed' | 'cancelled' | 'unknown';
export type LeaderboardPeriod = 'weekly' | 'monthly' | 'all_time';

export interface SafeProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  institution: string | null;
  total_xp: number;
}

export interface Group {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  description: string | null;
  group_type: GroupType;
  max_members: number;
  visibility: GroupVisibility;
  member_count: number;
  total_xp: number;
  group_level: number;
  current_streak: number;
  last_activity_date: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface GroupMembership {
  id: string;
  group_id: string;
  user_id: string;
  role: GroupRole;
  status: MembershipStatus;
  contribution_xp: number;
  joined_at: string;
  banned_until: string | null;
  group?: Group | null;
  profile?: SafeProfile | null;
}

export interface GroupsConfig {
  squadDefaultMembers: number;
  squadMaxMembers: number;
  communityMaxMembers: number;
  battleParticipationXp: number;
  battleWinnerBonusXp: number;
  leaderboardMinMembers: number;
}

export interface MyGroupsData {
  squad: GroupMembership | null;
  communities: GroupMembership[];
  pending: GroupMembership[];
  memberships: GroupMembership[];
}

export interface GroupPreview {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  description: string | null;
  group_type: GroupType;
  visibility: GroupVisibility;
  member_count: number;
  max_members: number;
  is_full: boolean;
  total_xp: number;
  group_level: number;
  my_status: MembershipStatus | null;
}

export interface GroupReplyMeta {
  id: string;
  sender_name: string;
  snippet: string;
}

export interface GroupDetailData {
  group: Group;
  myMembership: GroupMembership | null;
  isActiveMember: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  members: GroupMembership[];
  serverNow: string;
}

export interface DiscoverGroupsData {
  items: Group[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface GroupLeaderboardRow {
  group_id: string;
  period_type: LeaderboardPeriod;
  rank: number;
  previous_rank: number | null;
  total_xp: number;
  avg_xp: number;
  member_count: number;
  last_updated_at: string;
  group: Group | null;
  is_my_group: boolean;
}

export interface GroupLeaderboardData {
  period: LeaderboardPeriod;
  items: GroupLeaderboardRow[];
  myGroupIds: string[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  message_type: 'text' | 'emoji' | 'question_share' | 'system_alert';
  content: string | null;
  meta_data: Record<string, unknown> | null;
  created_at: string;
  is_flagged: boolean;
  deleted_at: string | null;
  sender?: SafeProfile | null;
}

export interface MessagesData {
  messages: GroupMessage[];
  hasMore: boolean;
  serverNow: string;
}

export interface Battle {
  id: string;
  group_id: string;
  title: string;
  initiated_by: string;
  status: 'pending' | 'ongoing' | 'completed' | 'cancelled';
  duration_minutes: number;
  subject_id: string | null;
  chapter_id: string | null;
  start_time: string;
  end_time: string;
  participant_count: number;
  winner_id: string | null;
  scores_snapshot: Record<string, unknown> | null;
  created_at: string;
  state: BattleState;
  finalizable_at: string | null;
  my_participation?: BattleParticipant | null;
}

export interface BattleParticipant {
  id: string;
  battle_id: string;
  user_id: string;
  status: 'joined' | 'submitted' | 'disqualified';
  score: number;
  correct_count: number;
  wrong_count: number;
  time_taken: number;
  rank: number | null;
  xp_awarded: number;
  joined_at: string;
  submitted_at: string | null;
  profile?: SafeProfile | null;
}

export interface BattlesData {
  battles: Battle[];
  serverNow: string;
}

export interface BattleDetailData {
  battle: Battle;
  participants: BattleParticipant[];
  standings: BattleParticipant[];
  winner: SafeProfile | null;
  myParticipation: BattleParticipant | null;
  serverNow: string;
}

export interface BattleQuestionsData {
  battle_id: string;
  title: string;
  duration_minutes: number;
  start_time: string;
  end_time: string;
  server_now: string;
  questions: BattleQuestion[];
}

export interface BattleQuestionOption {
  id: string;
  text?: string;
  text_bn?: string;
  text_en?: string;
  image_url?: string | null;
}

export interface BattleQuestion {
  id: string;
  text?: string;
  type?: string | null;
  difficulty_level?: number | null;
  image_url?: string | null;
  body?: {
    text_bn?: string | null;
    text_en?: string | null;
    image_url?: string | null;
  } | null;
  options: BattleQuestionOption[];
  comprehension?: {
    id: string;
    body: unknown;
    sequence?: number | null;
    media_library?: { file_url?: string } | null;
  } | null;
  media_library?: { file_url?: string } | null;
}

export interface BattleSubmitResult {
  battle_id: string;
  score: number;
  correct_count: number;
  wrong_count: number;
  skipped_count: number;
  total_questions: number;
  time_taken: number;
  submitted_at: string;
  state: BattleState;
  finalizable_at: string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}
