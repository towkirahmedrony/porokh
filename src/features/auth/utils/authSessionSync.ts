import type { Session } from '@supabase/supabase-js';
import type { AppUser } from '../types/auth';
import type { CachedProfileFields } from './profileCache';

/**
 * Supabase returns a brand-new session object on every `getSession()` call and
 * on every auth event (including token refreshes). Comparing the values that
 * actually matter — instead of the object identity — keeps the app from
 * re-applying an identical auth state and re-rendering the whole tree.
 */
export function isSameSession(
  current: Session | null,
  next: Session | null
): boolean {
  if (!current || !next) return current === next;

  return (
    current.access_token === next.access_token &&
    current.refresh_token === next.refresh_token &&
    current.user?.id === next.user?.id
  );
}

/**
 * A session refresh only carries auth claims. The profile row is the source of
 * truth for the fields below, so they must survive a token refresh instead of
 * being dropped back to whatever the JWT happens to include.
 */
export function mergeSessionUser(
  sessionUser: AppUser,
  previous: AppUser | null
): AppUser {
  const next: AppUser = {
    ...sessionUser,
    total_xp: sessionUser.total_xp ?? previous?.total_xp ?? 0,
    total_score: sessionUser.total_score ?? previous?.total_score ?? 0,
  };

  if (!previous || previous.id !== sessionUser.id) return next;

  return {
    ...next,
    full_name: previous.full_name ?? next.full_name ?? null,
    username: previous.username ?? next.username ?? null,
    avatar_url: previous.avatar_url ?? next.avatar_url ?? null,
    institution: previous.institution ?? next.institution ?? null,
    language_preference:
      previous.language_preference ?? next.language_preference ?? 'bn',
    // A token refresh carries no profile data. These fields decide the
    // onboarding gate, so dropping them here would send a finished user back
    // to the form until the next full reload.
    class_level: previous.class_level ?? next.class_level ?? null,
    group: previous.group ?? next.group ?? null,
    study_goal: previous.study_goal ?? next.study_goal ?? null,
    onboarding_completed_at:
      previous.onboarding_completed_at ?? next.onboarding_completed_at ?? null,
  };
}

const sameMetadataValue = (
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown> | undefined,
  key: string
) => (a?.[key] ?? null) === (b?.[key] ?? null);

/**
 * True when nothing the UI renders would change. Used as a `useState`
 * updater guard so a redundant auth event cannot schedule an extra render.
 */
export function isSameAppUser(
  current: AppUser | null,
  next: AppUser | null
): boolean {
  if (!current || !next) return current === next;

  const a = current;
  const b = next;

  return (
    current.id === next.id &&
    current.email === next.email &&
    current.email_confirmed_at === next.email_confirmed_at &&
    a.full_name === b.full_name &&
    a.username === b.username &&
    a.avatar_url === b.avatar_url &&
    a.institution === b.institution &&
    a.language_preference === b.language_preference &&
    a.class_level === b.class_level &&
    a.group === b.group &&
    a.study_goal === b.study_goal &&
    a.onboarding_completed_at === b.onboarding_completed_at &&
    (a.total_xp ?? 0) === (b.total_xp ?? 0) &&
    (a.total_score ?? 0) === (b.total_score ?? 0) &&
    current.app_metadata?.provider === next.app_metadata?.provider &&
    sameMetadataValue(current.user_metadata, next.user_metadata, 'full_name') &&
    sameMetadataValue(current.user_metadata, next.user_metadata, 'name') &&
    sameMetadataValue(current.user_metadata, next.user_metadata, 'avatar_url')
  );
}

/**
 * Overlays the cached profile row on a session user.
 *
 * The cache is a snapshot of the same `profiles` select the enrichment query
 * runs, so it wins over JWT claims (which never carry the onboarding flag or
 * academic fields). A `null` in the cache is a real answer and is kept.
 */
export function applyCachedProfile(
  user: AppUser,
  cached: CachedProfileFields
): AppUser {
  return {
    ...user,
    username: cached.username,
    full_name: cached.full_name,
    avatar_url: cached.avatar_url,
    institution: cached.institution,
    language_preference: cached.language_preference ?? 'bn',
    class_level: cached.class_level,
    group: cached.group,
    study_goal: cached.study_goal,
    onboarding_completed_at: cached.onboarding_completed_at,
    total_xp: cached.total_xp ?? 0,
    total_score: cached.total_xp ?? 0,
  };
}

/** Profile enrichment is required once per signed-in user, not per auth event. */
export function needsProfileEnrichment(
  enrichedUserId: string | null,
  nextUserId: string | null
): boolean {
  return Boolean(nextUserId) && enrichedUserId !== nextUserId;
}
