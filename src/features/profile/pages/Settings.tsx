import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Bell, ChevronRight, Globe, HelpCircle, Info, Lock, LogOut, Megaphone,
  Moon, MonitorSmartphone, Palette, Pencil, Puzzle, Shield, Sun, User,
  Users,
} from 'lucide-react';
import { BackButton } from '@/shared/components/ui/BackButton';
import ConfirmModal from '@/shared/components/feedback/ConfirmModal';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { useTheme } from '@/shared/hooks/useTheme';
import type { Theme } from '@/app/providers/ThemeProvider';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  APP_LANGUAGES,
  LANGUAGE_OPTION_LABELS,
  type AppMessageKey,
} from '@/shared/i18n/messages';
import {
  SettingsBottomSheet,
  SheetRadioRow,
} from '@/features/profile/components/SettingsBottomSheet';
import { ForcedUpdateCard } from '@/features/app-update/ForcedUpdateCard';
import NotificationPreferencesCard from '@/features/notifications/components/NotificationPreferencesCard';
import NativeNotificationSettingsCard from '@/features/notifications/components/NativeNotificationSettingsCard';
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
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center ${
          danger ? 'text-red-500' : 'text-text-secondary'
        }`}
      >
        <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span
          className={`block text-[15px] leading-6 font-medium break-words ${
            danger ? 'text-red-500' : 'text-text-primary'
          }`}
        >
          {title}
        </span>
        {description && (
          <span className="mt-0.5 block text-[13px] leading-[1.5] text-text-secondary break-words">
            {description}
          </span>
        )}
      </span>

      <span className="flex shrink-0 items-center gap-1.5">
        {rightText && (
          <span className="max-w-[40vw] text-[13px] leading-5 font-medium text-text-secondary break-words">
            {rightText}
          </span>
        )}
        {onClick && (
          <ChevronRight
            size={20}
            strokeWidth={2}
            className={danger ? 'text-red-500' : 'text-text-secondary'}
            aria-hidden="true"
          />
        )}
      </span>
    </>
  );

  const baseClass = `flex min-h-[64px] w-full items-center gap-3 px-4 py-3 transition-colors bg-card-bg ${
    onClick ? 'active:bg-surface-elevated/70 sm:hover:bg-surface-elevated/50' : ''
  } ${!isLast ? 'border-b border-border-color/60' : ''}`;

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
  <section className="mb-7 last:mb-0">
    <h2 className="px-4 mb-2 text-[13px] font-semibold text-primary">
      {title}
    </h2>
    <div className="overflow-hidden rounded-2xl bg-card-bg">
      {children}
    </div>
  </section>
);

// ------------------------------- Option sheets -------------------------------

interface ThemeOption {
  value: Theme;
  labelKey: AppMessageKey;
  icon: LucideIcon;
}

const THEME_OPTIONS: ThemeOption[] = [
  { value: 'system', labelKey: 'settings.themeSystem', icon: MonitorSmartphone },
  { value: 'light', labelKey: 'settings.themeLight', icon: Sun },
  { value: 'dark', labelKey: 'settings.themeDark', icon: Moon },
];

// --------------------------------- Page -----------------------------------

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { signOut, user } = useAuth();

  const [sheet, setSheet] = useState<'language' | 'theme' | null>(null);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const textFontClass =
    language === 'bn' ? "font-['Hind_Siliguri']" : 'font-sans';

  // The website always runs the deployed build, so update controls belong to
  // the Android app only.
  const native = Capacitor.isNativePlatform();

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      if (signOut) await signOut();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setLoggingOut(false);
      setLogoutConfirm(false);
    }
  }, [signOut]);

  const currentThemeLabel = (() => {
    const option = THEME_OPTIONS.find((item) => item.value === theme);
    return option ? t(option.labelKey) : theme;
  })();

  const displayName = user?.full_name || user?.username || user?.email || '';
  const usernameLine = user?.username && user.email ? `@${user.username}` : user?.email || '';

  return (
    <div className={`min-h-screen bg-app ${textFontClass}`}>
      <header
        className="sticky top-0 z-10 flex items-center gap-1 bg-app/95 backdrop-blur"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
      >
        <div className="flex h-14 w-full items-center gap-2 px-4">
          <BackButton />
          <h1 className="text-xl font-semibold leading-7 text-text-primary">
            {t('settings.title')}
          </h1>
        </div>
      </header>

      <div
        className="mx-auto w-full max-w-[640px] px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-2"
      >
        {user && (
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="mb-7 flex w-full items-center gap-4 rounded-2xl bg-card-bg p-4 text-left transition-colors active:bg-surface-elevated/70 sm:hover:bg-surface-elevated/50"
          >
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={displayName}
                width={56}
                height={56}
                className="h-14 w-14 shrink-0 rounded-full bg-surface-elevated object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-badge-bg text-lg font-semibold text-badge-text"
              >
                {(displayName || user.email || '?').trim().charAt(0).toUpperCase()}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[17px] leading-6 font-semibold text-text-primary">
                {displayName}
              </span>
              {usernameLine && (
                <span className="mt-0.5 block truncate text-[13px] leading-5 text-text-secondary">
                  {usernameLine}
                </span>
              )}
            </span>
            <ChevronRight size={20} className="shrink-0 text-text-secondary" aria-hidden="true" />
          </button>
        )}

        {/* A. Language, single app preference, chosen from a bottom sheet */}
        <SettingSection title={t('settings.sectionLanguage')}>
          <SettingRow
            icon={Globe}
            title={t('settings.languageLabel')}
            description={t('settings.languageDescription')}
            rightText={LANGUAGE_OPTION_LABELS[language]}
            onClick={() => setSheet('language')}
            isLast
          />
        </SettingSection>

        {/* B. Appearance, existing light/dark/system theme preference */}
        <SettingSection title={t('settings.sectionAppearance')}>
          <SettingRow
            icon={Palette}
            title={t('settings.themeLabel')}
            description={t('settings.themeDescription')}
            rightText={currentThemeLabel}
            onClick={() => setSheet('theme')}
            isLast
          />
        </SettingSection>

        {/* C. Account, existing profile and auth routes only */}
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
            onClick={() => setLogoutConfirm(true)}
            danger
            isLast
          />
        </SettingSection>

        {/* D. Preferences, supported notification settings only */}
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
          {user?.id && <NativeNotificationSettingsCard />}
          {user?.id && (
            <div className="px-4 pb-4 pt-4">
              <p className="text-[15px] leading-6 font-medium text-text-primary">
                {t('notification.preferencesTitle')}
              </p>
              <p className="mb-2 mt-0.5 text-[13px] leading-[1.5] text-text-secondary">
                {t('notification.preferencesDescription')}
              </p>
              <NotificationPreferencesCard userId={user.id} />
            </div>
          )}
        </SettingSection>

        {/* E. App updates, the single OTA/APK surface for the Android app */}
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

      <SettingsBottomSheet
        open={sheet === 'language'}
        title={t('settings.languageLabel')}
        onClose={() => setSheet(null)}
      >
        <div role="radiogroup" aria-label={t('settings.languageLabel')}>
          {APP_LANGUAGES.map((option) => (
            <SheetRadioRow
              key={option}
              checked={language === option}
              lang={option}
              label={LANGUAGE_OPTION_LABELS[option]}
              onSelect={() => {
                setLanguage(option);
                setSheet(null);
              }}
            />
          ))}
        </div>
      </SettingsBottomSheet>

      <SettingsBottomSheet
        open={sheet === 'theme'}
        title={t('settings.themeLabel')}
        onClose={() => setSheet(null)}
      >
        <div role="radiogroup" aria-label={t('settings.themeLabel')}>
          {THEME_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <SheetRadioRow
                key={option.value}
                checked={theme === option.value}
                label={t(option.labelKey)}
                icon={<Icon size={20} strokeWidth={1.75} aria-hidden="true" />}
                onSelect={() => {
                  setTheme(option.value);
                  setSheet(null);
                }}
              />
            );
          })}
        </div>
      </SettingsBottomSheet>

      <ConfirmModal
        isOpen={logoutConfirm}
        title={t('settings.logoutConfirmTitle')}
        message={t('settings.logoutConfirmBody')}
        confirmText={t('settings.logout')}
        cancelText={t('common.cancel')}
        loadingText={t('settings.logout')}
        isLoading={loggingOut}
        onConfirm={() => void handleLogout()}
        onCancel={() => setLogoutConfirm(false)}
      />
    </div>
  );
};

export default Settings;
