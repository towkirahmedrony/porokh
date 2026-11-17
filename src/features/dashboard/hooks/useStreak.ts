import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/hooks/useAuth';
import { QUERY_KEYS } from '@/shared/constants/storageKeys';
import { supabase } from '@/shared/lib/supabase';
import { buildApiUrl } from '@/shared/lib/apiConfig';

export interface DailyActivity {
  activity_date: string;
  exams_taken: number;
  study_time_minutes: number;
  xp_earned: number;
  used_freeze?: boolean;
}

export interface StreakDataResponse {
  currentStreak: number;
  longestStreak: any;
  freezesLeft: number;
  activities: DailyActivity[];
}

export interface UseStreakReturn extends StreakDataResponse {
  loading: boolean;
  error: Error | string | null;
}

export const useStreak = (targetUserId?: string): UseStreakReturn => {
  const { user } = useAuth();

  const effectiveUserId = targetUserId || user?.id;

  const { data, isLoading, error } = useQuery({
    queryKey: [...(QUERY_KEYS.STREAK_STATS || ['streak']), effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return null;

      try {
        // ১. টোকেন সংগ্রহ
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        
        const baseUrl = buildApiUrl('/growth');

        // ৩. ব্যাকএন্ড থেকে stats এবং heatmap একসাথে ফেচ করা
        const [statsRes, heatmapRes] = await Promise.all([
          fetch(`${baseUrl}/stats/${effectiveUserId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`${baseUrl}/heatmap/${effectiveUserId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);

        if (!statsRes.ok || !heatmapRes.ok) {
          throw new Error('Backend API error');
        }

        const statsJson = await statsRes.json();
        const heatmapJson = await heatmapRes.json();

        return {
          currentStreak: statsJson.data?.current_streak ?? 0,
          longestStreak: statsJson.data?.longest_streak ?? null,
          freezesLeft: statsJson.data?.freezes_left ?? 2,
          activities: heatmapJson.data ?? [],
        } as StreakDataResponse;

      } catch (err) {
        console.error('API Error, falling back to direct DB fetch:', err);
        
        // 💡 ফলব্যাক: যদি কোনো কারণে ব্যাকএন্ড রেসপন্স না দেয়, তখন ডাটাবেস থেকে সাধারণ কুয়েরি করবে
        const { data: profile } = await supabase
          .from('profiles')
          .select('current_streak, freezes_left')
          .eq('id', effectiveUserId)
          .single();

        const { data: activities } = await supabase
          .from('user_daily_activities')
          .select('activity_date, exams_taken, study_time_minutes, xp_earned, used_freeze')
          .eq('user_id', effectiveUserId);

        return {
          currentStreak: profile?.current_streak ?? 0,
          longestStreak: null, 
          freezesLeft: profile?.freezes_left ?? 2,
          activities: activities ?? [],
        } as StreakDataResponse;
      }
    },
    enabled: !!effectiveUserId,
    staleTime: 0, // সবসময় ফ্রেশ ডেটা আনবে
  });

  return {
    currentStreak: data?.currentStreak ?? 0,
    longestStreak: data?.longestStreak ?? null,
    freezesLeft: data?.freezesLeft ?? 2,
    activities: data?.activities ?? [],
    loading: isLoading,
    error: error ? 'streak.dataLoadError' : null,
  };
};
