import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';

/**
 * এখন কোনো published এক্সাম লাইভ আছে কিনা (start_time <= now <= end_time)।
 * প্রতি ১ মিনিটে রিচেক করে, তাই এক্সাম শুরু/শেষে হোমের নোটিস নিজে থেকে আসে/চলে যায়।
 */
export const useLiveExamActive = () => {
  const query = useQuery({
    queryKey: ['live_exam_active'],
    queryFn: async (): Promise<boolean> => {
      const nowIso = new Date().toISOString();

      const { data, error } = await supabase
        .from('exam_papers')
        .select('id')
        .eq('is_published', true)
        .lte('start_time', nowIso)
        .gte('end_time', nowIso)
        .limit(1);

      if (error) throw error;

      return (data?.length ?? 0) > 0;
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  return {
    isLive: query.data === true,
    loading: query.isLoading,
  };
};
