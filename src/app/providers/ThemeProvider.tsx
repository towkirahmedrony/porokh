import {
  createContext,
  useEffect,
  useCallback,
  useMemo,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import apiClient from '@/shared/lib/apiClient';
import { useLocalStorage } from '@/shared/hooks/useLocalStorage';
import { StorageUtils } from '@/shared/utils/storage';
import { STORAGE_KEYS } from '@/shared/constants/storageKeys';
import {
  DEFAULT_THEME_PREFERENCE,
  getNextThemePreference,
  normalizeThemePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from '@/shared/utils/themePreference';

export type Theme = ThemePreference;
export type { ResolvedTheme };

export type ThemeColors = {
  bgApp?: string;
  bgSurface?: string;
  bgSurfaceElevated?: string;
  textPrimary?: string;
  textSecondary?: string;
  borderColor?: string;
  inputBg?: string;
  inputBorder?: string;
  primary?: string;
  primaryForeground?: string;
  secondary?: string;
  accent?: string;
  success?: string;
  warning?: string;
  danger?: string;
  info?: string;
  navBg?: string;
  navText?: string;
  cardBg?: string;
  cardBorder?: string;
  badgeBg?: string;
  badgeText?: string;
  focusRing?: string;
};

type GlobalThemeConfig = {
  colors?: {
    dark?: ThemeColors;
    light?: ThemeColors;
    default?: ThemeColors;
  } | ThemeColors | null;
  active_theme?: string | null;
  bgType?: string | null;
  bgMediaUrl?: string | null;
};

type ThemeProviderState = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  globalConfig: GlobalThemeConfig | null;
};

const initialState: ThemeProviderState = {
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => undefined,
  toggleTheme: () => undefined,
  globalConfig: null,
};

export const ThemeContext = createContext<ThemeProviderState>(initialState);

function prefersDarkMode(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

function getResolvedMode(theme: Theme): ResolvedTheme {
  return resolveTheme(theme, prefersDarkMode());
}

function getFallbackSemanticColors(mode: 'light' | 'dark'): Required<ThemeColors> {
  return mode === 'dark'
    ? {
        bgApp: '#0F1115',
        bgSurface: '#1E293B',
        bgSurfaceElevated: '#334155',
        textPrimary: '#F8FAFC',
        textSecondary: '#94A3B8',
        borderColor: '#334155',
        inputBg: '#0F172A',
        inputBorder: '#475569',
        primary: '#3B82F6',
        primaryForeground: '#FFFFFF',
        secondary: '#1E293B',
        accent: '#6366F1',
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#0EA5E9',
        navBg: '#1E293B',
        navText: '#94A3B8',
        cardBg: '#1E293B',
        cardBorder: '#334155',
        badgeBg: '#1E3A8A',
        badgeText: '#DBEAFE',
        focusRing: '#3B82F6',
      }
    : {
        bgApp: '#F8FAFC',
        bgSurface: '#FFFFFF',
        bgSurfaceElevated: '#FFFFFF',
        textPrimary: '#0F172A',
        textSecondary: '#64748B',
        borderColor: '#E2E8F0',
        inputBg: '#FFFFFF',
        inputBorder: '#CBD5E1',
        primary: '#2563EB',
        primaryForeground: '#FFFFFF',
        secondary: '#F1F5F9',
        accent: '#4F46E5',
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#0EA5E9',
        navBg: '#FFFFFF',
        navText: '#64748B',
        cardBg: '#FFFFFF',
        cardBorder: '#E2E8F0',
        badgeBg: '#DBEAFE',
        badgeText: '#1E40AF',
        focusRing: '#93C5FD',
      };
}

function extractColorsForMode(configColors: GlobalThemeConfig['colors'], mode: 'light' | 'dark'): ThemeColors | null {
  if (!configColors) return null;
  if ('dark' in configColors || 'light' in configColors || 'default' in configColors) {
    const structured = configColors as { dark?: ThemeColors; light?: ThemeColors; default?: ThemeColors };
    if (mode === 'dark' && structured.dark) return structured.dark;
    if (mode === 'light' && structured.light) return structured.light;
    if (structured.default) return structured.default;
    return null;
  }
  if (mode === 'dark') return null; // Fallback to local dark mode if API only gave flat light colors
  return configColors as ThemeColors;
}

function toKebabCase(str: string): string {
  return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
}

function applyResolvedThemeToDom(theme: Theme, config?: GlobalThemeConfig | null) {
  if (typeof window === 'undefined') return;

  const root = window.document.documentElement;
  const body = window.document.body;
  const resolvedMode = getResolvedMode(theme);

  root.classList.remove('light', 'dark');
  root.classList.add(resolvedMode);
  root.style.colorScheme = resolvedMode;

  const fallbackColors = getFallbackSemanticColors(resolvedMode);
  const apiColors = extractColorsForMode(config?.colors, resolvedMode);

  const activeColors = { ...fallbackColors, ...apiColors };

  // Set CSS variables dynamically
  Object.entries(activeColors).forEach(([key, value]) => {
    if (value) {
      root.style.setProperty(`--${toKebabCase(key)}`, value as string);
    }
  });

  // Background implementations
  if (body) {
    let bgImage = 'none';
    if (config?.bgType === 'image' && config.bgMediaUrl) {
      bgImage = `url("${config.bgMediaUrl}")`;
    }
    body.style.backgroundColor = activeColors.bgApp;
    body.style.backgroundImage = bgImage;
    body.style.backgroundSize = 'cover';
    body.style.backgroundPosition = 'center';
    body.style.backgroundAttachment = 'scroll';
    body.style.color = activeColors.textPrimary;
  }

  if (config) {
    StorageUtils.set(STORAGE_KEYS.DYN_THEME_CONFIG, config);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [storedTheme, setThemeState] = useLocalStorage<Theme>(
    STORAGE_KEYS.THEME,
    DEFAULT_THEME_PREFERENCE
  );
  // A missing or invalid stored value falls back to the system preference,
  // matching the inline bootstrap script in `index.html`.
  const theme: Theme =
    normalizeThemePreference(storedTheme) ?? DEFAULT_THEME_PREFERENCE;
  const [systemDark, setSystemDark] = useState<boolean>(prefersDarkMode);
  const resolvedTheme = resolveTheme(theme, systemDark);

  const { data: globalConfig = null } = useQuery<GlobalThemeConfig | null>({
    queryKey: ['theme-config'],
    queryFn: async () => {
      // 👈 এখানে /system থেকে /app-builder করা হয়েছে
      const res = await apiClient.get('/app-builder/theme-config');
      return (res.data?.data?.value ?? res.data?.data ?? null) as GlobalThemeConfig | null;
    },
    staleTime: 1000 * 15,
    refetchOnWindowFocus: true,
  });

  const syncThemeToDom = useCallback((nextTheme: Theme) => {
    const cachedConfig = StorageUtils.get(STORAGE_KEYS.DYN_THEME_CONFIG) as GlobalThemeConfig | null;
    applyResolvedThemeToDom(nextTheme, globalConfig ?? cachedConfig);
  }, [globalConfig]);

  useEffect(() => {
    const fetchUserTheme = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase.from('profiles').select('settings').eq('id', session.user.id).single();
      if (data?.settings && typeof data.settings === 'object') {
        const dbTheme = normalizeThemePreference(
          (data.settings as Record<string, unknown>).theme
        );
        if (dbTheme) {
          setThemeState(dbTheme);
        }
      }
    };
    void fetchUserTheme();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') void fetchUserTheme();
    });
    return () => subscription.unsubscribe();
  }, [setThemeState]);

  useLayoutEffect(() => {
    syncThemeToDom(theme);
  }, [theme, resolvedTheme, location.key, syncThemeToDom]);

  // Track the device system theme so the app follows it live (web and the
  // Capacitor Android WebView both expose it via `prefers-color-scheme`)
  // without a restart. `addListener` is the legacy fallback for media
  // queries that predate `addEventListener`.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    setSystemDark(mq.matches);
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handleChange);
      return () => mq.removeEventListener('change', handleChange);
    }
    mq.addListener(handleChange);
    return () => mq.removeListener(handleChange);
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    syncThemeToDom(newTheme);
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data: profile } = await supabase.from('profiles').select('settings').eq('id', session.user.id).single();
      const currentSettings = profile?.settings && typeof profile.settings === 'object' ? (profile.settings as Record<string, unknown>) : {};
      await supabase.from('profiles').update({ settings: { ...currentSettings, theme: newTheme } }).eq('id', session.user.id);
    })();
  }, [setThemeState, syncThemeToDom]);

  // Flip the resolved theme, not the raw preference: with the `system`
  // default, `theme === 'dark'` is false even when the device is dark, so
  // toggling would otherwise appear to do nothing.
  const toggleTheme = useCallback(
    () => setTheme(getNextThemePreference(resolvedTheme)),
    [setTheme, resolvedTheme]
  );
  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme, globalConfig }),
    [theme, resolvedTheme, setTheme, toggleTheme, globalConfig]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
