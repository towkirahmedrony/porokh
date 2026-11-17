import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { accessService, ACCESS_STALE_TIME_MS } from '../services/accessService';
import type { AccessPayload, FeatureUsage } from '../types';

export const ACCESS_QUERY_KEY = ['me', 'access'] as const;

const EXAM_FEATURE = 'exam_start';

const findFeature = (
  features: FeatureUsage[],
  feature: string
): FeatureUsage | undefined => features.find((item) => item.feature === feature);

export const useAccess = () => {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...ACCESS_QUERY_KEY, user?.id ?? 'anonymous'],
    queryFn: accessService.fetchMyAccess,
    enabled: !authLoading && !!user?.id,
    staleTime: ACCESS_STALE_TIME_MS,
    gcTime: 1000 * 60 * 60 * 12,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: (failureCount, error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      // Authentication and authorization problems will not fix themselves.
      if (status === 401 || status === 403) return false;
      return failureCount < 2;
    },
  });

  const payload: AccessPayload = query.data ?? { access: null, features: [] };
  const access = payload.access;
  const features = payload.features;

  const examFeature = findFeature(features, EXAM_FEATURE);

  const isPremium = !!access?.premium;
  const unlimitedAll = !!access?.unlimited_all;
  const unlimitedExam =
    unlimitedAll || !!examFeature?.unlimited || !!access?.unlimited_features?.includes(EXAM_FEATURE);

  /** Remaining free exams today; `null` means unlimited / not metered. */
  const examsLeft = useMemo<number | null>(() => {
    if (unlimitedExam) return null;
    if (!examFeature) return null;
    return Math.max(0, examFeature.remaining ?? 0);
  }, [examFeature, unlimitedExam]);

  /** Milliseconds until the daily quota resets; `null` when unknown. */
  const resetsIn = useMemo<number | null>(() => {
    const resetAt = examFeature?.reset_at;
    if (!resetAt) return null;
    const target = Date.parse(resetAt);
    if (Number.isNaN(target)) return null;
    return Math.max(0, target - Date.now());
  }, [examFeature?.reset_at]);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ACCESS_QUERY_KEY });
  }, [queryClient]);

  // Schedule a refresh for the moment the daily quota rolls over so the UI
  // never shows yesterday's remaining count after midnight (Asia/Dhaka).
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }

    const resetAt = examFeature?.reset_at;
    if (!resetAt) return;

    const delay = Date.parse(resetAt) - Date.now();
    if (Number.isNaN(delay)) return;

    // Re-check a second after the boundary to absorb clock skew.
    const schedule = Math.max(1000, delay + 1000);
    if (schedule > 2_147_000_000) return; // setTimeout overflow guard

    resetTimer.current = setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: ACCESS_QUERY_KEY });
    }, schedule);

    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, [examFeature?.reset_at, queryClient]);

  return {
    access,
    features,
    examFeature,
    isPremium,
    unlimitedExam,
    examsLeft,
    resetsIn,
    resetAt: examFeature?.reset_at ?? null,
    isLoading: authLoading || query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    isAuthenticated: !!user?.id,
    refresh,
  };
};

/** Invalidate cached access after any access-changing operation. */
export const useInvalidateAccess = () => {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ACCESS_QUERY_KEY });
  }, [queryClient]);
};

export default useAccess;
