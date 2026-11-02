import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { STORAGE_KEYS } from '@/shared/constants/storageKeys';
import { StorageUtils } from '@/shared/utils/storage';
import { supabase } from '@/shared/lib/supabase';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  APP_MESSAGES,
  lookupMessage,
  type AppLanguage,
  type AppMessageKey,
} from './messages';
import {
  normalizeLanguage,
  readStoredLanguage,
  resolveInitialLanguage,
  shouldAdoptProfileLanguage,
} from './languagePreference';

type MessageValues = Record<string, string | number>;

export interface LanguageContextValue {
  /** Currently active language (single authoritative state). */
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  /**
   * Application-wide translator. Falls back to Bengali, then to the raw key,
   * so a missing translation can never crash a screen.
   */
  t: (key: AppMessageKey, values?: MessageValues) => string;
  /** True while the visitor is on a homepage route (drives SEO metadata). */
  isHomepage: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

// "/" is the public marketing homepage, which owns its own metadata through
// `usePageMeta`. Only the signed-in home screens use the dictionary defaults.
const HOMEPAGE_PATHS = new Set(['/dashboard', '/dashboard/home']);

export const isHomepagePath = (pathname: string): boolean => {
  if (!pathname) return false;
  const normalized =
    pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return HOMEPAGE_PATHS.has(normalized);
};

const formatMessage = (template: string, values?: MessageValues): string => {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match
  );
};

const upsertMetaTag = (
  attribute: 'name' | 'property',
  key: string,
  content: string
): void => {
  if (typeof document === 'undefined') return;

  let tag = document.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${key}"]`
  );

  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }

  tag.setAttribute('content', content);
};

const applyHomepageMetadata = (language: AppLanguage): void => {
  const messages = APP_MESSAGES[language];

  document.title = messages['meta.title'];

  upsertMetaTag('name', 'description', messages['meta.description']);
  upsertMetaTag('property', 'og:title', messages['meta.title']);
  upsertMetaTag('property', 'og:description', messages['meta.description']);
  upsertMetaTag('property', 'og:locale', messages['meta.ogLocale']);
  upsertMetaTag('name', 'twitter:title', messages['meta.title']);
  upsertMetaTag('name', 'twitter:description', messages['meta.description']);
};

/**
 * Application-level language provider. One state instance lives at the app
 * root and is shared by every screen and both navigation variants, so switching
 * once updates the whole UI immediately, survives refresh via localStorage and
 * does not remount or reset any route state.
 *
 * Precedence is defined in `languagePreference.ts`: a choice persisted by this
 * browser always wins over the profile value, and the profile only seeds the
 * language when this browser has never chosen one.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user, setLanguagePreference } = useAuth();

  // True once this browser holds a language choice the user made (restored
  // from storage on first render, or set in this session). While it is false
  // the signed-in profile may seed the language; once true it never may.
  const hasPersistedChoiceRef = useRef<boolean>(false);
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    const stored = readStoredLanguage();
    hasPersistedChoiceRef.current = stored !== null;
    return resolveInitialLanguage(stored);
  });

  const isHomepage = isHomepagePath(location.pathname);

  const setLanguage = useCallback(
    (nextLanguage: AppLanguage) => {
      if (normalizeLanguage(nextLanguage) === null) return;
      // Clicking the already-active language must not write storage or the
      // profile again (and must not re-render every consumer).
      if (nextLanguage === language) return;

      hasPersistedChoiceRef.current = true;
      setLanguageState(nextLanguage);
      StorageUtils.set(STORAGE_KEYS.LANGUAGE, nextLanguage);
      // Keep the cached profile value aligned so no later reconciliation can
      // revert the switch to the previous server value.
      setLanguagePreference(nextLanguage);

      if (user?.id) {
        void supabase
          .from('profiles')
          .update({ language_preference: nextLanguage })
          .eq('id', user.id)
          .then(({ error }) => {
            if (error) {
              // The local preference is authoritative for this browser; a
              // failed profile write must not undo the switch.
              console.warn('Language preference sync failed:', error.message);
            }
          });
      }
    },
    [language, setLanguagePreference, user?.id]
  );

  // Seed from the signed-in profile only when this browser has no choice yet.
  useEffect(() => {
    if (hasPersistedChoiceRef.current) return;
    if (!shouldAdoptProfileLanguage(readStoredLanguage(), user?.language_preference)) {
      return;
    }

    const profileLanguage = normalizeLanguage(user?.language_preference);
    if (!profileLanguage || profileLanguage === language) return;

    hasPersistedChoiceRef.current = true;
    setLanguageState(profileLanguage);
    StorageUtils.set(STORAGE_KEYS.LANGUAGE, profileLanguage);
  }, [language, user?.language_preference]);

  // Keep tabs in sync when the preference changes elsewhere.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== null && event.key !== STORAGE_KEYS.LANGUAGE) return;
      const stored = readStoredLanguage();
      if (stored === null) return;

      hasPersistedChoiceRef.current = true;
      setLanguageState(stored);
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const t = useCallback(
    (key: AppMessageKey, values?: MessageValues): string => {
      return formatMessage(lookupMessage(language, key), values);
    },
    [language]
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;

    // The document language always reflects the active preference.
    document.documentElement.lang = language;

    if (isHomepage) {
      applyHomepageMetadata(language);
    }
  }, [isHomepage, language]);

  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage, t, isHomepage }),
    [language, setLanguage, t, isHomepage]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = (): LanguageContextValue => {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }

  return context;
};
