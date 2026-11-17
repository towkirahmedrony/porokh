import { STORAGE_KEYS } from '@/shared/constants/storageKeys';
import {
  DEFAULT_APP_LANGUAGE,
  isAppLanguage,
  type AppLanguage,
} from './messages';

/**
 * Language preference resolution, kept free of React so the rules that decide
 * "which language is active" can be unit tested directly.
 *
 * Precedence (highest first):
 *   1. A preference this browser has persisted (the user's explicit choice,
 *      written by the switcher).
 *   2. The signed-in profile's `language_preference` (seeds a fresh browser).
 *   3. `DEFAULT_APP_LANGUAGE` (Bangla).
 *
 * A profile value never overrides a persisted local choice. Writing the
 * profile value back into local state on every render is what made the
 * switcher appear dead: the click set `en`, the profile sync immediately reset
 * it to the stale server value.
 */

export type LanguageStorage = Pick<Storage, 'getItem'>;

/** Returns a valid language or `null` for anything unrecognised. */
export const normalizeLanguage = (value: unknown): AppLanguage | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return isAppLanguage(normalized) ? normalized : null;
};

/**
 * Reads the persisted preference. Handles both the JSON form written by
 * `StorageUtils.set` (`"en"`) and a plain string (`en`) left by older builds.
 * Returns `null` when nothing usable is stored.
 */
export const readStoredLanguage = (
  storage?: LanguageStorage | null
): AppLanguage | null => {
  const target =
    storage ?? (typeof window === 'undefined' ? null : window.localStorage);
  if (!target) return null;

  try {
    const raw = target.getItem(STORAGE_KEYS.LANGUAGE);
    if (!raw) return null;

    try {
      return normalizeLanguage(JSON.parse(raw));
    } catch {
      return normalizeLanguage(raw);
    }
  } catch {
    return null;
  }
};

/** Language used for the very first render, before a profile is available. */
export const resolveInitialLanguage = (
  stored: AppLanguage | null,
  profilePreference?: unknown
): AppLanguage =>
  stored ?? normalizeLanguage(profilePreference) ?? DEFAULT_APP_LANGUAGE;

/**
 * Whether the signed-in profile may replace the active language.
 * Only when this browser has no persisted choice of its own.
 */
export const shouldAdoptProfileLanguage = (
  stored: AppLanguage | null,
  profilePreference?: unknown
): boolean => {
  if (stored !== null) return false;
  const profile = normalizeLanguage(profilePreference);
  return profile !== null;
};
