/**
 * Theme preference resolution, kept free of React so the rules that decide
 * "which theme is active" can be unit tested directly.
 *
 * Precedence (highest first):
 *   1. The user's explicit preference (`light` / `dark`), persisted locally
 *      and on the profile.
 *   2. The device system theme (`system`), which is the default for users
 *      without an existing preference.
 */

export type ThemePreference = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

/** Users without a saved preference follow the device system theme. */
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';

/** Returns a valid theme preference or `null` for anything unrecognised. */
export const normalizeThemePreference = (
  value: unknown
): ThemePreference | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized === 'light' ||
    normalized === 'dark' ||
    normalized === 'system'
    ? normalized
    : null;
};

/** Resolves a preference to the concrete light/dark theme to apply. */
export const resolveTheme = (
  preference: ThemePreference,
  prefersDark: boolean
): ResolvedTheme => {
  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  return prefersDark ? 'dark' : 'light';
};

/**
 * Resolves whatever is persisted to the concrete theme to apply. A missing or
 * invalid stored value falls back to the system preference, matching the
 * inline bootstrap script in `index.html`.
 */
export const resolveThemePreference = (
  stored: unknown,
  prefersDark: boolean
): ResolvedTheme =>
  resolveTheme(normalizeThemePreference(stored) ?? DEFAULT_THEME_PREFERENCE, prefersDark);

/** The explicit preference that flips the currently resolved theme. */
export const getNextThemePreference = (
  resolved: ResolvedTheme
): ThemePreference => (resolved === 'dark' ? 'light' : 'dark');
