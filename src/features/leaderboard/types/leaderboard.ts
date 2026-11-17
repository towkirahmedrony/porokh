export interface LeaderboardUser {
  id: string;                  // profiles.id
  username?: string;           // যুক্ত করা হয়েছে (URL রাউটিং এর জন্য)
  full_name: string | null;    // profiles.full_name
  total_score: number;         // global_leaderboard_cache.total_score
  total_xp?: number;           // Backend fallback variant for total score
  rank: number;                // global_leaderboard_cache.rank
  current_streak: number;      // profiles.current_streak
  institution?: string | null; // profiles.institution
  avatar_url?: string | null;  // profiles.avatar_url
  
  // Frontend Specific States
  is_current_user?: boolean;
  league?: string;
}

export interface League {
  id: number;
  name_bn: string;
  name_en: string;
  min_xp: number;
  max_xp: number | null;
  badge_url: string | null;
}
