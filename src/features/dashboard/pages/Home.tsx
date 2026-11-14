import React, { memo, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SunMedium } from 'lucide-react';
import FeatureGrid, { ThemeConfig } from '../components/FeatureGrid';
import DynamicBanner from '../components/DynamicBanner';
import { useAuth } from '../../auth/hooks/useAuth';
import { supabase } from '@/shared/lib/supabase';
import { useHomeGrids } from '../hooks/useHomeGrids';
import { matchesHomeGridTargetRules } from '../utils/homeGridTargeting';
import { useLiveExamActive } from '../hooks/useLiveExamActive';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';
import { PromoBanner } from '@/features/access/components/PromoBanner';
import UrgentNoticeStrip from '@/features/notices/components/UrgentNoticeStrip';
import type { AppMessageKey } from '@/shared/i18n/messages';
import {
  normalizeDisplayName,
  resolveNamecardName,
  shouldShowNameSkeleton,
} from '../utils/namecard';

interface ThemeConfigRow {
  value?: unknown;
  ui_theme_settings?: unknown;
}

interface HomeBannerRow {
  id: string;
  title: string | null;
  title_en?: string | null;
  title_bn?: string | null;
  image_url: string | null;
  action_link: string | null;
  target_rules: unknown;
  description?: string | null;
  description_en?: string | null;
  description_bn?: string | null;
  button_text?: string | null;
  button_text_en?: string | null;
  button_text_bn?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

const LIVE_EXAM_LINK_PREFIX = '/exam/live';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const sanitizeThemeConfig = (input: unknown): ThemeConfig | undefined => {
  if (!isRecord(input)) return undefined;

  return {
    active_theme:
      typeof input.active_theme === 'string' ? input.active_theme : undefined,
    greeting_bg_url:
      typeof input.greeting_bg_url === 'string'
        ? input.greeting_bg_url
        : undefined,
  };
};

const getGreetingKey = (hour: number): AppMessageKey => {
  if (hour < 5) return 'home.greetingLateNight';
  if (hour < 12) return 'home.greetingMorning';
  if (hour < 17) return 'home.greetingAfternoon';
  if (hour < 20) return 'home.greetingEvening';

  return 'home.greetingLateNight';
};

const isLiveExamBanner = (banner: HomeBannerRow) => {
  return (banner.action_link ?? '').startsWith(LIVE_EXAM_LINK_PREFIX);
};

const isWithinSchedule = (banner: HomeBannerRow, now: number) => {
  const start = banner.start_date ? Date.parse(banner.start_date) : NaN;
  const end = banner.end_date ? Date.parse(banner.end_date) : NaN;

  if (!Number.isNaN(start) && now < start) return false;
  if (!Number.isNaN(end) && now > end) return false;

  return true;
};

const Home: React.FC = memo(() => {
  const { user, loading: authLoading, profileStatus } = useAuth();
  const { features, loading: featuresLoading, error: featuresError, refetch: refetchFeatures } = useHomeGrids();
  const { isLive: isLiveExamActive } = useLiveExamActive();
  const { language, t } = useLanguage();
  const { isOffline } = useNetworkStatus();

  const textFontClass =
    language === 'bn' ? "font-['Hind_Siliguri']" : 'font-sans';

  const metadataName =
    normalizeDisplayName(user?.user_metadata?.full_name) ||
    normalizeDisplayName(user?.user_metadata?.name);

  const { data: themeData } = useQuery({
    queryKey: ['app_configs', 'theme_config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_configs')
        .select('value, ui_theme_settings')
        .eq('key', 'theme_config')
        .maybeSingle<ThemeConfigRow>();

      if (error) throw error;

      return data?.value ?? data?.ui_theme_settings ?? null;
    },
  });

  const { data: activeBanners } = useQuery({
    queryKey: ['home_banners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('home_banners')
        .select('*')
        .eq('is_active', true)
        .order('sequence', { ascending: true });

      if (error) throw error;

      return data;
    },
  });

  // লাইভ এক্সাম ব্যানার শুধু এক্সাম চলাকালীন দেখাবে; বাকি ব্যানার আগের মতোই।
  const visibleBanners = useMemo(() => {
    const now = Date.now();
    const profile = {
      studyGoal: user?.study_goal ?? null,
      classLevel: user?.class_level ?? null,
      group: user?.group ?? null,
    };

    return ((activeBanners ?? []) as HomeBannerRow[]).filter((banner) => {
      if (!isWithinSchedule(banner, now)) return false;
      if (!matchesHomeGridTargetRules(banner.target_rules, profile)) return false;
      if (isLiveExamBanner(banner)) return isLiveExamActive;
      return true;
    });
  }, [activeBanners, isLiveExamActive, user?.study_goal, user?.class_level, user?.group]);

  const resolvedProfileName = resolveNamecardName({
    fullName: user?.full_name,
    username: user?.username,
    metadataName,
  });
  const isNameLoading =
    authLoading ||
    (Boolean(user?.id) &&
      (profileStatus === 'idle' || profileStatus === 'loading'));
  // Never swap a known name back to a skeleton. Profile enrichment is
  // background work; only the very first paint (no name at all) may show it.
  const showNameSkeleton = shouldShowNameSkeleton(
    resolvedProfileName,
    isNameLoading
  );
  const displayName = resolvedProfileName ?? t('home.studentFallback');

  const themeConfig = sanitizeThemeConfig(themeData);
  const greetingKey = getGreetingKey(new Date().getHours());

  return (
    <div className="min-h-screen bg-app pb-24">
      <main className="mx-auto w-full max-w-6xl px-3 pt-3">
        <section className="relative overflow-hidden rounded-[20px] border border-card-border bg-card-bg px-4 py-3">
          <div className="relative z-10 flex items-center justify-between">
            <div className="min-w-0 flex-1 pr-3" aria-busy={isNameLoading}>
              {/* Fixed height keeps the card's footprint identical whether the
                  name is loading or already known. The subtitle is always
                  rendered so the card never grows/shrinks during data loads. */}
              <div className="flex min-h-[28px] items-center">
                {showNameSkeleton ? (
                  <div
                    role="status"
                    aria-label={t('home.loadingProfile')}
                    className="h-7 w-32 animate-pulse rounded-lg bg-secondary"
                  />
                ) : (
                  <h1
                    className={`truncate text-lg font-bold text-text-primary ${textFontClass}`}
                  >
                    {displayName}
                  </h1>
                )}
              </div>
              <p
                className={`mt-0.5 truncate text-xs text-text-secondary ${textFontClass}`}
              >
                {t('home.startLearning')}
              </p>
            </div>

            <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-badge-bg px-2.5 py-1.5 text-badge-text">
              <SunMedium className="h-3.5 w-3.5" />
              <span
                className={`text-[11px] font-semibold ${textFontClass}`}
              >
                {t(greetingKey)}
              </span>
            </div>
          </div>
        </section>

        <PromoBanner className="mt-2" />

        <UrgentNoticeStrip />

        <DynamicBanner
          banners={visibleBanners.length > 0 ? visibleBanners : null}
          isLoading={false}
        />

        <section className="mt-3">
          <FeatureGrid
            features={features}
            loading={featuresLoading}
            error={featuresError}
            onRetry={() => void refetchFeatures()}
            themeConfig={themeConfig}
            loadingLabel={t('home.featuresLoading')}
            offline={isOffline}
          />
        </section>
      </main>
    </div>
  );
});

Home.displayName = 'Home';

export default Home;
