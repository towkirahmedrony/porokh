/**
 * Notification tap routing.
 *
 * The backend stores `action_link` as an in-app path (`/history`,
 * `/exam/live?x=1`). Anything else — an absolute URL, a protocol-relative
 * path, an app-scheme link or a route this build no longer serves — falls back
 * to the notification list instead of navigating into a broken screen.
 */

export const DEFAULT_PUSH_TARGET = '/notifications';

/**
 * Routes this build can open. Kept as prefixes so parameterised routes
 * (`/exam/attempt/:id`) resolve without listing every id.
 */
const ALLOWED_PREFIXES = [
  '/auth',
  '/onboarding',
  '/dashboard',
  '/history',
  '/profile',
  '/settings',
  '/notifications',
  '/notices',
  '/exams',
  '/exam',
  '/admission',
  '/groups',
  '/group',
  '/progress',
  '/premium',
  '/referral',
  '/question-bank',
  '/bank',
  '/parasathi',
  '/support',
  '/materials',
  '/suggestion',
  '/quests',
  '/edit-profile',
  '/change-password',
] as const;

const UNSAFE_CHARS = /[\u0000-\u001f\u007f\\]/;

export const isSafeInternalPath = (value: string): boolean =>
  value.startsWith('/') &&
  !value.startsWith('//') &&
  !value.includes('://') &&
  !UNSAFE_CHARS.test(value);

export const isKnownAppPath = (pathname: string): boolean =>
  ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

export const resolvePushTarget = (raw: unknown): string => {
  if (typeof raw !== 'string') return DEFAULT_PUSH_TARGET;

  const candidate = raw.trim();
  if (!candidate || !isSafeInternalPath(candidate)) return DEFAULT_PUSH_TARGET;

  // Validate only the path; a query string is legal and preserved for routes
  // such as /question-bank?subject=... .
  const pathOnly = candidate.split(/[?#]/)[0];
  if (!isKnownAppPath(pathOnly)) return DEFAULT_PUSH_TARGET;

  return candidate;
};

/**
 * Handles taps exactly once. Android may deliver the same message through
 * `handleOnNewIntent` and through the plugin's pending-message replay after a
 * cold start, so the message id is the identity that matters.
 */
export const createTapDeduper = (limit = 20) => {
  const seen: string[] = [];

  return (id: unknown): boolean => {
    if (typeof id !== 'string' || !id) return true;
    if (seen.includes(id)) return false;

    seen.push(id);
    if (seen.length > limit) seen.shift();
    return true;
  };
};
