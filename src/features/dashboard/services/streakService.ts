import { supabase } from '@/shared/lib/supabase';

export interface DailyActivity {
  activity_date: string;
  exams_taken: number;
  xp_earned: number;
  study_time_minutes: number;
}

export interface LongestStreak {
  longest_streak_days: number;
  streak_start_date: string;
  streak_end_date: string;
}

export interface StreakDataResponse {
  currentStreak: number;
  longestStreak: LongestStreak | null;
  activities: DailyActivity[];
  freezesLeft: number; // Added to match previous UI requirements
}

export const fetchStreakData = async (userId: string): Promise<StreakDataResponse> => {
  if (!userId) throw new Error("User ID is required to fetch streak data");

  const [currentRes, longestRes, activitiesRes] = await Promise.all([
    supabase.rpc('get_current_streak', { p_user_id: userId }),
    supabase.rpc('get_longest_streak', { p_user_id: userId }),
    supabase.from('user_daily_activities')
      .select('activity_date, exams_taken, xp_earned, study_time_minutes')
      .eq('user_id', userId)
  ]);

  if (currentRes.error) throw currentRes.error;
  if (longestRes.error) throw longestRes.error;
  if (activitiesRes.error) throw activitiesRes.error;

  // Safe type extraction without 'as unknown as'
  const currentStreak = Number(currentRes.data) || 0;
  
  // Handle case where RPC might return an array or a single object
  const rawLongestStreak = Array.isArray(longestRes.data) ? longestRes.data[0] : longestRes.data;
  const longestStreak = rawLongestStreak ? (rawLongestStreak as LongestStreak) : null;

  return {
    currentStreak,
    longestStreak,
    activities: (activitiesRes.data as DailyActivity[]) || [],
    freezesLeft: 2, // Hardcoded fallback; update RPC to return this if needed in the future
  };
};
