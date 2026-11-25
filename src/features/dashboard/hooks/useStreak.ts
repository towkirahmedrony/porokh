import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/hooks/useAuth';
import { QUERY_KEYS } from '@/shared/constants/storageKeys';
import { supabase } from '@/shared/lib/supabase';

export interface DailyActivity {
  activity_date: string;
  exams_taken: number;
  study_time_minutes: number;
  xp_earned: number;
  used_freeze?: boolean;
}

export interface LongestStreak {
  longest_streak_days: number;
  streak_start_date: string | null;
  streak_end_date: string | null;
}

export interface StreakDataResponse {
  currentStreak: number;
  longestStreak: LongestStreak | null;
  freezesLeft: number;
  activities: DailyActivity[];
}

export interface UseStreakReturn extends StreakDataResponse {
  loading: boolean;
  error: Error | string | null;
}

type HeatmapDay = {
  cal_date: string;
  exams_taken: number;
  study_time_minutes: number;
  xp_earned: number;
};

const streakQueryKey = (userId: string) => [...QUERY_KEYS.STREAK_STATS, userId];

/**
 * Streak state is read, never computed.
 *
 * profiles.current_streak and profiles.freezes_left are maintained by the
 * database (exam_history / user_daily_activities triggers plus the daily freeze
 * cron), the 365-day calendar comes from get_user_heatmap, and the best record
 * from get_longest_streak. The client only displays those values, so it can
 * never disagree with the server about how many days a student has.
 */
export const useStreak = (targetUserId?: string): UseStreakReturn => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const effectiveUserId = targetUserId || user?.id;
  const isOwnStreak = !!effectiveUserId && effectiveUserId === user?.id;

  const { data, isLoading, error } = useQuery({
    queryKey: streakQueryKey(effectiveUserId ?? 'anonymous'),
    queryFn: async (): Promise<StreakDataResponse | null> => {
      if (!effectiveUserId) return null;

      const [profileResult, longestResult, heatmapResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('current_streak, freezes_left')
          .eq('id', effectiveUserId)
          .maybeSingle(),
        supabase.rpc('get_longest_streak', { p_user_id: effectiveUserId }),
        supabase.rpc('get_user_heatmap', { p_user_id: effectiveUserId }),
      ]);

      if (profileResult.error) throw profileResult.error;
      if (longestResult.error) throw longestResult.error;
      if (heatmapResult.error) throw heatmapResult.error;

      // used_freeze is not part of get_user_heatmap, so the freeze markers are
      // merged in separately. RLS only returns the signed-in user's rows.
      const frozenDays = new Set<string>();
      if (isOwnStreak) {
        const { data: frozenRows } = await supabase
          .from('user_daily_activities')
          .select('activity_date')
          .eq('user_id', effectiveUserId)
          .eq('used_freeze', true);

        (frozenRows ?? []).forEach((row) => frozenDays.add(row.activity_date));
      }

      return {
        currentStreak: profileResult.data?.current_streak ?? 0,
        freezesLeft: profileResult.data?.freezes_left ?? 0,
        longestStreak: (longestResult.data?.[0] as LongestStreak | undefined) ?? null,
        activities: ((heatmapResult.data ?? []) as HeatmapDay[]).map((day) => ({
          activity_date: day.cal_date,
          exams_taken: day.exams_taken ?? 0,
          study_time_minutes: day.study_time_minutes ?? 0,
          xp_earned: day.xp_earned ?? 0,
          used_freeze: frozenDays.has(day.cal_date),
        })),
      };
    },
    enabled: !!effectiveUserId,
    staleTime: 30 * 1000,
  });

  // The database refreshes profiles.current_streak on every submit and on the
  // daily freeze run; subscribing to the row shows those changes on an open
  // streak screen without polling.
  useEffect(() => {
    if (!isOwnStreak || !effectiveUserId) return;

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      // Realtime authorises with the current JWT, so the channel is opened only
      // once the session has been restored.
      const { data: sessionData } = await supabase.auth.getSession();
      if (cancelled || !sessionData.session?.access_token) return;

      channel = supabase
        .channel(`streak:${effectiveUserId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${effectiveUserId}`,
          },
          () => {
            void queryClient.invalidateQueries({
              queryKey: streakQueryKey(effectiveUserId),
            });
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [effectiveUserId, isOwnStreak, queryClient]);

  return {
    currentStreak: data?.currentStreak ?? 0,
    longestStreak: data?.longestStreak ?? null,
    freezesLeft: data?.freezesLeft ?? 0,
    activities: data?.activities ?? [],
    loading: isLoading,
    error: error ? 'streak.dataLoadError' : null,
  };
};
