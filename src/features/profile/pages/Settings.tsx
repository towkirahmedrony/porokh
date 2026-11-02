import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, ChevronRight, Globe, HelpCircle, Info, Lock, LogOut, Megaphone,
  Moon, MonitorSmartphone, Palette, Pencil, Puzzle, Shield, Sun, User,
  Users, LucideIcon,
} from 'lucide-react';
import { BackButton } from '@/shared/components/ui/BackButton';
import LanguageSwitcher from '@/shared/components/ui/LanguageSwitcher';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { useTheme } from '@/shared/hooks/useTheme';
import type { Theme } from '@/app/providers/ThemeProvider';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { LANGUAGE_OPTION_LABELS } from '@/shared/i18n/messages';
import { ForcedUpdateCard } from '@/features/app-update/ForcedUpdateCard';
import NotificationPreferencesCard from '@/features/notifications/components/NotificationPreferencesCard';
import { Capacitor } from '@capacitor/core';

// --------------------------------- Pieces ---------------------------------

interface SettingRowProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  onClick?: () => void;
  danger?: boolean;
  rightText?: string;
  isLast?: boolean;
}

interface SettingSectionProps {
  title: string;
  children: React.ReactNode;
}

const SettingRow: React.FC<SettingRowProps> = ({
  icon: Icon,
  title,
  description,
  onClick,
  danger = false,
  rightText = '',
  isLast = false,
}) => {
  const content = (
    <>
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-elevated ${
            danger ? 'text-red-500' : 'text-primary'
          }`}
        >
          <Icon size={18} />
        </span>
        <span className="min-w-0 text-left">
          <span
            className={`block truncate text-sm font-medium ${
              danger ? 'text-red-500' : 'text-text-primary'
            }`}
          >
            {title}
          </span>
          {description && (
            <span className="mt-0.5 block text-xs leading-5 text-text-secondary">
              {description}
            </span>
          )}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {rightText && (
          <span className="text-xs font-medium text-text-secondary">
            {rightText}
          </span>
        )}
        {onClick && (
          <ChevronRight
            className={`w-4 h-4 ${danger ? 'text-red-500' : 'text-text-secondary'}`}
          />
        )}
      </div>
    </>
  );

  const baseClass = `flex w-full items-center justify-between gap-3 p-4 transition-colors bg-card-bg ${
    onClick ? 'hover:bg-surface-elevated' : ''
  } ${!isLast ? 'border-b border-border-color' : ''}`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={baseClass}>
        {content}
      </button>
    );
  }

  return <div className={baseClass}>{content}</div>;
};

const SettingSection: React.FC<SettingSectionProps> = ({ title, children }) => (
  <section className="mb-6">
    <h2 className="px-1 mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
      {title}
    </h2>
    <div className="overflow-hidden rounded-xl border shadow-sm bg-card-bg border-border-color">
      {children}
    </div>
  </section>
);

// ------------------------------- Theme picker -------------------------------

const THEME_OPTIONS: { value: Theme; labelKey: 'settings.themeSystem' | 'settings.themeLight' | 'settings.themeDark'; icon: LucideIcon }[] = [
  { value: 'system', labelKey: 'settings.themeSystem', icon: MonitorSmartphone },
  { value: 'light', labelKey: 'settings.themeLight', icon: Sun },
  { value: 'dark', labelKey: 'settings.themeDark', icon: Moon },
];

const ThemePicker: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();

  return (
    <div
      role="group"
      aria-label={t('settings.themeLabel')}
      className="inline-flex shrink-0 items-center rounded-full border border-border-color bg-surface-elevated p-0.5"
    >
      {THEME_OPTIONS.map((option) => {
        const isActive = theme === option.value;
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            aria-pressed={isActive}
            title={t(option.labelKey)}
            aria-label={t(option.labelKey)}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card-bg sm:px-3 sm:text-xs ${
              isActive
                ? 'bg-badge-bg text-badge-text shadow-sm'
                : 'text-text-secondary hover:bg-secondary hover:text-text-primary'
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{t(option.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
};

// --------------------------------- Page -----------------------------------

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const { signOut, user } = useAuth();

  const textFontClass =
    language === 'bn' ? "font-['Hind_Siliguri']" : 'font-sans';

  // The website always runs the deployed build, so update controls belong to
  // the Android app only.
  const native = Capacitor.isNativePlatform();

  const handleLogout = useCallback(async () => {
    try {
      if (signOut) await signOut();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, [signOut]);

  return (
    <div className={`min-h-screen pb-20 bg-app ${textFontClass}`}>
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 shadow-sm bg-card-bg">
        <BackButton />
        <h1 className="text-lg font-bold text-text-primary">
          {t('settings.title')}
        </h1>
      </header>

      <div className="p-4 max-w-2xl mx-auto">
        {/* A. Language — the single language preference for the app */}
        <SettingSection title={t('settings.sectionLanguage')}>
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-elevated text-primary">
                <Globe size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary">
                  {t('settings.languageLabel')}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-text-secondary">
                  {t('settings.languageDescription')}
                </p>
                <p
                  className="mt-1 text-xs font-semibold text-primary"
                  aria-live="polite"
                >
                  {t('settings.languageCurrent', {
                    language: LANGUAGE_OPTION_LABELS[language],
                  })}
                </p>
              </div>
            </div>

            <LanguageSwitcher className="self-start sm:self-auto" />
          </div>
        </SettingSection>

        {/* B. Appearance — existing light/dark/system theme preference */}
        <SettingSection title={t('settings.sectionAppearance')}>
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-elevated text-primary">
                <Palette size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary">
                  {t('settings.themeLabel')}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-text-secondary">
                  {t('settings.themeDescription')}
                </p>
              </div>
            </div>

            <ThemePicker />
          </div>
        </SettingSection>

        {/* C. Account — existing profile & auth routes only */}
        <SettingSection title={t('settings.sectionAccount')}>
          <SettingRow
            icon={User}
            title={t('settings.viewProfile')}
            onClick={() => navigate('/profile')}
          />
          <SettingRow
            icon={Pencil}
            title={t('settings.editProfile')}
            onClick={() => navigate('/edit-profile')}
          />
          <SettingRow
            icon={Lock}
            title={t('settings.changePassword')}
            onClick={() => navigate('/change-password')}
          />
          <SettingRow
            icon={LogOut}
            title={t('settings.logout')}
            onClick={handleLogout}
            danger
            isLast
          />
        </SettingSection>

        {/* D. Preferences — genuinely supported notification settings */}
        <SettingSection title={t('settings.sectionPreferences')}>
          <SettingRow
            icon={Megaphone}
            title={t('settings.notices')}
            description={t('settings.noticesDescription')}
            onClick={() => navigate('/notices')}
          />
          <SettingRow
            icon={Bell}
            title={t('settings.notifications')}
            description={t('settings.notificationsDescription')}
            onClick={() => navigate('/notifications')}
          />
          {user?.id && (
            <div className="pt-2">
              <p className="text-sm font-semibold text-text-primary">
                {t('notification.preferencesTitle')}
              </p>
              <p className="mb-1 text-[11px] text-text-secondary">
                {t('notification.preferencesDescription')}
              </p>
              <NotificationPreferencesCard userId={user.id} />
            </div>
          )}
        </SettingSection>

        {/* E. App updates — the single OTA/APK surface for the Android app */}
        {native ? (
          <SettingSection title={t('settings.sectionUpdates')}>
            <ForcedUpdateCard />
          </SettingSection>
        ) : null}

        {/* F. About */}
        <SettingSection title={t('settings.sectionAbout')}>
          <SettingRow icon={Info} title={t('settings.appName')} />
          <SettingRow
            icon={Shield}
            title={t('settings.aboutUs')}
            onClick={() => navigate('/about')}
          />
          <SettingRow
            icon={HelpCircle}
            title={t('settings.faq')}
            onClick={() => navigate('/faq')}
          />
          <SettingRow
            icon={Users}
            title={t('settings.help')}
            onClick={() => navigate('/contact')}
          />
          <SettingRow
            icon={Puzzle}
            title={t('settings.privacy')}
            onClick={() => navigate('/privacy-policy')}
            isLast
          />
        </SettingSection>
      </div>
    </div>
  );
};

export default Settings;
