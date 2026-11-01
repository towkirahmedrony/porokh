import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/lib/apiClient';
import { QUERY_KEYS } from '@/shared/constants/storageKeys';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { matchesHomeGridTargetRules } from '../utils/homeGridTargeting';

export type HomeGridTargetRules = Record<string, unknown>;

export interface GridItem {
  id: string;
  title: string;
  title_bn?: string | null;
  title_en?: string | null;
  icon_name: string;
  image_url: string | null;
  link: string | null;
  type: string | null;
  bg_color: string | null;
  color: string | null;
  serial_order?: number | null;
  is_active: boolean;
  target_rules: HomeGridTargetRules | null;
}

interface HomeGridsResponse {
  data?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const toNullableString = (value: unknown): string | null => {
  return typeof value === 'string' ? value : null;
};

const toNullableRules = (value: unknown): HomeGridTargetRules | null => {
  if (!isRecord(value)) return null;

  return Object.keys(value).length > 0 ? value : null;
};

const sanitizeGridItem = (input: unknown): GridItem | null => {
  if (!isRecord(input)) return null;

  const id = toNullableString(input.id);
  const title = toNullableString(input.title);

  if (!id || !title) {
    return null;
  }

  // An empty icon_name is not a reason to hide the card: image-only cards and
  // unknown icon names both fall back to the registry default at render time.
  return {
    id,
    title,
    title_bn: toNullableString(input.title_bn),
    title_en: toNullableString(input.title_en),
    icon_name: toNullableString(input.icon_name) ?? '',
    image_url: toNullableString(input.image_url),
    link: toNullableString(input.link),
    type: toNullableString(input.type),
    bg_color: toNullableString(input.bg_color),
    color: toNullableString(input.color),
    serial_order: typeof input.serial_order === 'number' ? input.serial_order : null,
    is_active: input.is_active !== false,
    target_rules: toNullableRules(input.target_rules),
  };
};

const sanitizeGridItems = (input: unknown): GridItem[] => {
  if (!Array.isArray(input)) return [];

  return input
    .map(sanitizeGridItem)
    .filter((item): item is GridItem => item !== null)
    .filter((item) => item.is_active)
    .sort((a, b) => (a.serial_order ?? Number.MAX_SAFE_INTEGER) - (b.serial_order ?? Number.MAX_SAFE_INTEGER));
};

export const useHomeGrids = () => {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: QUERY_KEYS.HOME_GRIDS,
    queryFn: async (): Promise<GridItem[]> => {
      const { data } = await apiClient.get<HomeGridsResponse>('/app-builder/home-grids?active=true');
      return sanitizeGridItems(data?.data);
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  // Filter against the profile at render time so a profile refresh does not
  // need a second network request for the cards themselves.
  const features = useMemo(() => {
    const profile = {
      studyGoal: user?.study_goal ?? null,
      classLevel: user?.class_level ?? null,
      group: user?.group ?? null,
    };

    return (query.data ?? []).filter((item) =>
      matchesHomeGridTargetRules(item.target_rules, profile)
    );
  }, [query.data, user?.study_goal, user?.class_level, user?.group]);

  const loading = query.isLoading && features.length === 0;

  return {
    features,
    loading,
    isRefetching: query.isFetching && !query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};
