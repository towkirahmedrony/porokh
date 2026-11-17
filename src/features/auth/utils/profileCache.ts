import { STORAGE_KEYS } from '@/shared/constants/storageKeys';
import { StorageUtils } from '@/shared/utils/storage';

/**
 * Offline fallback for the profile row.
 *
 * The profile row is the only source of two values the app cannot start
 * without: the display name and `onboarding_completed_at`. Both used to be
 * fetched on every launch, which made the whole startup dependent on a
 * successful Supabase read — an offline launch therefore had no way to know
 * that the user had already finished onboarding.
 *
 * The cache is deliberately:
 *  - keyed by user id, so one account's row can never answer for another,
 *  - versioned, so a schema change drops instead of misreads old data,
 *  - free of secrets: only the columns the UI already renders are stored.
 */
export const PROFILE_CACHE_VERSION = 1;

/** Columns cached for offline startup. Mirrors the enrichment select. */
export interface CachedProfileFields {
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  institution: string | null;
  total_xp: number | null;
  language_preference: string | null;
  class_level: string | null;
  group: string | null;
  study_goal: string | null;
  onboarding_completed_at: string | null;
}

export interface CachedProfile {
  version: number;
  userId: string;
  cachedAt: number;
  profile: CachedProfileFields;
}

type ProfileCacheKey = `${typeof STORAGE_KEYS.AUTH_PROFILE_CACHE_PREFIX}${string}`;

const keyFor = (userId: string): ProfileCacheKey =>
  `${STORAGE_KEYS.AUTH_PROFILE_CACHE_PREFIX}${userId}`;

const toNullableString = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

const toNullableNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/**
 * Accepts a raw profile row and keeps only known, correctly typed fields. A
 * malformed or partial row still produces a usable profile object rather than
 * failing the whole read.
 */
export const normalizeCachedProfile = (
  input: Record<string, unknown>
): CachedProfileFields => ({
  username: toNullableString(input.username),
  full_name: toNullableString(input.full_name),
  avatar_url: toNullableString(input.avatar_url),
  institution: toNullableString(input.institution),
  total_xp: toNullableNumber(input.total_xp),
  language_preference: toNullableString(input.language_preference),
  class_level: toNullableString(input.class_level),
  group: toNullableString(input.group),
  study_goal: toNullableString(input.study_goal),
  onboarding_completed_at: toNullableString(input.onboarding_completed_at),
});

export const writeCachedProfile = (
  userId: string,
  profile: CachedProfileFields,
  now: number = Date.now()
): void => {
  if (!userId) return;

  StorageUtils.set<CachedProfile>(keyFor(userId), {
    version: PROFILE_CACHE_VERSION,
    userId,
    cachedAt: now,
    profile,
  });
};

/**
 * Returns the cached row only when it belongs to the requested user and matches
 * the current cache version. Anything else is treated as a cache miss.
 */
export const readCachedProfile = (
  userId: string | null | undefined
): CachedProfileFields | null => {
  if (!userId) return null;

  const cached = StorageUtils.get<CachedProfile>(keyFor(userId));
  if (!cached || typeof cached !== 'object') return null;
  if (cached.version !== PROFILE_CACHE_VERSION) return null;
  if (cached.userId !== userId) return null;
  if (!cached.profile || typeof cached.profile !== 'object') return null;

  return normalizeCachedProfile(
    cached.profile as unknown as Record<string, unknown>
  );
};

/** Drops one user's cached row (used on sign-out / account handover). */
export const clearCachedProfile = (userId: string | null | undefined): void => {
  if (!userId) return;
  StorageUtils.remove(keyFor(userId));
};
