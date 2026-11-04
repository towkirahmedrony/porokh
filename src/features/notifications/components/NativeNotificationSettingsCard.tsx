import React from 'react';
import { Bell, Settings2 } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
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
    <div className="flex flex-col gap-3 border-b border-border-color bg-card-bg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-elevated text-primary">
            <Bell size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary">
              {t('notification.deviceTitle')}
            </p>
            <p className="mt-0.5 text-xs leading-5 text-text-secondary">
              {t('notification.deviceDescription')}
            </p>
            <p
              className="mt-1 text-xs font-semibold text-primary"
              aria-live="polite"
            >
              {statusLabel}
            </p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={
            enabled
              ? t('notification.deviceDisable')
              : t('notification.deviceEnable')
          }
          aria-busy={busy}
          disabled={busy || checking}
          onClick={handleToggle}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            enabled
              ? 'bg-primary'
              : 'border border-border-color bg-surface-elevated'
          } ${busy || checking ? 'cursor-wait opacity-70' : ''}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
              enabled ? 'left-[22px]' : 'left-0.5'
            }`}
          />
        </button>
      </div>

      {checking ? (
        <div className="h-9 animate-pulse rounded-lg bg-surface-elevated" />
      ) : null}

      {!enabled && !checking ? (
        <p className="text-xs leading-5 text-text-secondary">
          {t('notification.deviceBenefits')}
        </p>
      ) : null}

      {permissionDenied ? (
        <>
          <p className="text-xs leading-5 text-text-secondary">
            {t('notification.deviceDeniedHelp')}
          </p>
          <button
            type="button"
            onClick={() => void openSettings()}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-border-color bg-surface-elevated px-3 py-1.5 text-xs font-semibold text-primary"
          >
            <Settings2 size={14} aria-hidden="true" />
            {t('notification.deviceOpenSettings')}
          </button>
        </>
      ) : null}

      {error ? (
        <p className="text-xs leading-5 text-red-500" role="alert">
          {t('notification.deviceError')}
        </p>
      ) : null}
    </div>
  );
};

export default NativeNotificationSettingsCard;
