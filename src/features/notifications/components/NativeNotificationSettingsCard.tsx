import React from 'react';
import { Bell, Settings2 } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { SettingsSwitch } from '@/features/profile/components/SettingsSwitch';
import { useNativePush } from '../native/NativePushProvider';

/**
 * Device-level notification control inside the existing Settings screen.
 *
 * It sits next to (not instead of) the global preference card: this switch is
 * about this phone's registration, the other one is about notification types
 * across every device. Hidden entirely on the web and on APKs that predate the
 * push plugin.
 */
const NativeNotificationSettingsCard: React.FC = () => {
  const { t } = useLanguage();
  const {
    available,
    status,
    checking,
    busy,
    registered,
    error,
    enable,
    disable,
    openSettings,
  } = useNativePush();

  if (!available) return null;

  const enabled = status === 'granted' && registered;
  const permissionDenied = status === 'denied';

  const statusLabel = checking
    ? t('notification.deviceChecking')
    : status === 'granted'
      ? t('notification.deviceStatusGranted')
      : permissionDenied
        ? t('notification.deviceStatusDenied')
        : t('notification.deviceStatusPrompt');

  const handleToggle = () => {
    if (busy || checking) return;
    // Android will not show the dialog again after a denial; the only honest
    // next step is the system settings screen.
    if (permissionDenied) {
      void openSettings();
      return;
    }
    void (enabled ? disable() : enable());
  };

  return (
    <div className="flex flex-col gap-3 border-b border-border-color/60 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center text-text-secondary">
          <Bell size={22} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-6 font-medium text-text-primary">
            {t('notification.deviceTitle')}
          </p>
          <p className="mt-0.5 text-[13px] leading-[1.5] text-text-secondary break-words">
            {t('notification.deviceDescription')}
          </p>
          <p
            className="mt-0.5 text-[13px] leading-5 font-medium text-primary"
            aria-live="polite"
          >
            {statusLabel}
          </p>
        </div>

        <SettingsSwitch
          checked={enabled}
          label={
            enabled
              ? t('notification.deviceDisable')
              : t('notification.deviceEnable')
          }
          busy={busy}
          disabled={checking}
          onChange={handleToggle}
        />
      </div>

      {checking ? (
        <div className="h-8 animate-pulse rounded-full bg-surface-elevated" />
      ) : null}

      {!enabled && !checking ? (
        <p className="text-[13px] leading-[1.5] text-text-secondary break-words">
          {t('notification.deviceBenefits')}
        </p>
      ) : null}

      {permissionDenied ? (
        <>
          <p className="text-[13px] leading-[1.5] text-text-secondary break-words">
            {t('notification.deviceDeniedHelp')}
          </p>
          <button
            type="button"
            onClick={() => void openSettings()}
            className="inline-flex min-h-[36px] w-fit items-center gap-2 rounded-full border border-border-color px-4 py-2 text-[13px] font-medium text-primary transition-colors active:bg-surface-elevated sm:hover:bg-surface-elevated/50"
          >
            <Settings2 size={16} aria-hidden="true" />
            {t('notification.deviceOpenSettings')}
          </button>
        </>
      ) : null}

      {error ? (
        <p className="text-[13px] leading-[1.5] text-red-500 break-words" role="alert">
          {t('notification.deviceError')}
        </p>
      ) : null}
    </div>
  );
};

export default NativeNotificationSettingsCard;
