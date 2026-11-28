import { useMemo } from 'react';
import { useAdmissionHubCatalog } from '@/features/admission/hooks/useAdmissionHub';

/**
 * Institution id → logo URL, read from the admission catalog the app already
 * caches.
 *
 * The question bank hubs only carry the institution's name and counts, while
 * `institutions.logo_url` lives on the admission catalog. Joining the two in the
 * client is what lets the bank show the same logo the admission grid shows,
 * without a logo column of its own. A university the catalog does not hold (or
 * one with no logo) simply has no entry, and its card falls back to initials.
 */
export function useUniversityLogoMap(enabled = true): Record<string, string> {
  const { data } = useAdmissionHubCatalog(enabled);

  return useMemo(() => {
    const map: Record<string, string> = {};
    for (const university of data ?? []) {
      if (university.logoUrl) map[university.id] = university.logoUrl;
    }
    return map;
  }, [data]);
}