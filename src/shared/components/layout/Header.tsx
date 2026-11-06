import React from 'react';
import { Bell, Flame, Star } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { supabase } from '../../lib/supabase';
import { buildApiUrl } from '../../lib/apiConfig';
import { fetchUnreadNotificationCount } from '@/features/notifications/services/notificationService';
import { useUnreadNoticeCount } from '@/features/notices/hooks/useNotices';

const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t, language } = useLanguage();

  const isDashboardHome =
    location.pathname === '/dashboard' ||
    location.pathname === '/dashboard/home';

  const { data: profileData } = useQuery({
    queryKey: ['profile', 'stats', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        const baseUrl = buildApiUrl('/growth/stats');

        const response = await fetch(baseUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const json = await response.json();
          return json.data;
        }
      } catch (error) {
        console.error('API Error, falling back to Supabase:', error);
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('current_streak, total_xp')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && isDashboardHome,
    staleTime: 0,
  });

  const { data: notificationUnreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'unreadCount', user?.id],
    queryFn: () => (user?.id ? fetchUnreadNotificationCount() : 0),
    enabled: !!user?.id,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: noticeUnreadCount = 0 } = useUnreadNoticeCount();

  const unreadCount = notificationUnreadCount + noticeUnreadCount;

  const currentStreak =
    profileData?.current_streak ?? user?.user_metadata?.current_streak ?? 0;

  const xp = profileData?.total_xp ?? user?.user_metadata?.total_xp ?? 0;

  return (
    <header className="sticky top-0 z-20 h-16 border-b border-border-color bg-surface px-4 text-text-primary transition-colors duration-500">
      <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between">
        <Link
          to="/dashboard"
          aria-label={t('header.logoAria')}
          title={t('header.logoTitle')}
          className="flex items-center"
        >
          <span className="logo" lang={language}>
            {t('appName')}
          </span>
        </Link>

        <nav
          aria-label={t('header.shortcutsLabel')}
          className="flex items-center gap-2 sm:gap-3"
        >
          {/* Language selection lives in Settings; the header keeps only
              progress, streak and notifications. */}
          <button
            type="button"
            onClick={() => navigate('/dashboard/leaderboard')}
            aria-label={`${t('header.leaderboardAria')}: ${xp}`}
            title={t('header.leaderboardTitle')}
            className="flex items-center gap-1.5 rounded-full border border-border-color bg-surface-elevated px-3 py-1.5 transition-all hover:scale-105"
          >
            <Star size={18} className="fill-blue-500 text-blue-500" />
            <span className="font-sans text-sm font-bold text-text-primary">
              {xp}
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/dashboard/streak')}
            aria-label={t('header.streakAria', { count: currentStreak })}
            title={t('header.streakTitle')}
            className="flex items-center gap-1.5 rounded-full border border-border-color bg-surface-elevated px-3 py-1.5 transition-all hover:scale-105"
          >
            <Flame size={18} className="fill-orange-500 text-orange-500" />
            <span className="font-sans text-sm font-bold text-text-primary">
              {currentStreak}
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/notifications')}
            aria-label={
              unreadCount > 0
                ? t('header.unreadNotifications', { count: unreadCount })
                : t('header.noUnreadNotifications')
            }
            title={t('header.notificationsTitle')}
            className="relative rounded-full bg-surface-elevated p-2 text-text-primary transition-all hover:scale-110"
          >
            <Bell size={22} />
            {unreadCount > 0 && (
              <span
                className="absolute right-0 top-0 flex items-center justify-center rounded-full border-2 border-surface bg-badge-bg text-[10px] font-bold text-badge-text"
                style={{
                  minWidth: '18px',
                  height: '18px',
                  padding: '0 4px',
                }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
};

export default Header;
