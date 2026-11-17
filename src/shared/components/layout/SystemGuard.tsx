import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, Loader2, RefreshCw, Wrench, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/shared/lib/apiClient';
import { useLocalStorage } from '@/shared/hooks/useLocalStorage';
import { STORAGE_KEYS } from '@/shared/constants/storageKeys';
import { getDeviceId } from '@/shared/utils/device';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { pickLang } from '@/shared/i18n/localize';
import { getExamActivities, subscribeExamActivity } from '@/features/app-update/examActivity';
import { isExamBusy } from '@/features/app-update/activationGate';
import { currentBuild } from '@/features/app-update/buildInfo';
import { purgeFrontendCaches, reloadFromNetwork, writePendingReload } from '@/features/app-update/cacheRecovery';
import {
  decideUpdate,
  normalizeUpdatePolicy,
  type UpdateDecision,
} from '@/features/app-update/versionPolicy';
import { Capacitor } from '@capacitor/core';
import { useOta } from '@/features/app-update/UpdateProvider';

interface GlobalNotice {
  is_active: boolean;
  title: string;
  message: string;
  action_link?: string;
}

interface SystemConfig {
  key: string;
  value?: any;
  ui_theme_settings?: any;
  maintenance_mode?: boolean;
  maintenance_message?: string;
  maintenance_message_en?: string | null;
}

interface SystemGuardProps {
  children: React.ReactNode;
}

/**
 * Enforces the admin-controlled maintenance and update policy.
 *
 * Version identity is the whole point of this component, so it never assumes
 * the three numbers are interchangeable (see `versionPolicy.ts`):
 *  - the APK requirement is compared with the installed native version,
 *  - the OTA requirement with the running bundle version,
 *  - the website needs no blocking screen because a reload picks it up.
 */
export const SystemGuard: React.FC<SystemGuardProps> = ({ children }) => {
  const { language, t } = useLanguage();
  const location = useLocation();
  const ota = useOta();
  const [, setActivityRevision] = useState(0);
  useEffect(() => subscribeExamActivity(() => setActivityRevision((value) => value + 1)), []);
  const examBusy = isExamBusy(getExamActivities(), location.pathname);
  const [dismissedNoticeId, setDismissedNoticeId] = useLocalStorage<string | null>(STORAGE_KEYS.DISMISSED_NOTICE, null);
  const [dismissedUpdateVersion, setDismissedUpdateVersion] = useLocalStorage<string | null>(
    STORAGE_KEYS.DISMISSED_UPDATE,
    null
  );
  const [, setOtaAttempt] = useState(0);

  const { data: configs, isLoading } = useQuery<SystemConfig[]>({
    queryKey: ['system-configs'],
    queryFn: async () => {
      const response = await apiClient.get('/system/configs');
      return response.data?.data || [];
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  const { maintenance, policy, globalNotice } = useMemo(() => {
    let maintenance = { active: false, message: '' };
    let policy = normalizeUpdatePolicy(null);
    let globalNotice: GlobalNotice | null = null;

    if (configs) {
      const globalConfig = configs.find((c) => c.key === 'global_settings');
      if (globalConfig?.maintenance_mode) {
        maintenance = {
          active: true,
          message: pickLang(language, globalConfig.maintenance_message, globalConfig.maintenance_message_en),
        };
      }

      const policyConfig = configs.find((c) => c.key === 'update_policy');
      policy = normalizeUpdatePolicy(policyConfig?.value);

      const noticeConfig = configs.find((c) => c.key === 'global_notice');
      if (noticeConfig?.value?.is_active) {
        globalNotice = noticeConfig.value;
      }
    }

    return { maintenance, policy, globalNotice };
  }, [configs, language]);

  const build = currentBuild();
  const native = Capacitor.isNativePlatform();

  const decision: UpdateDecision = useMemo(
    () =>
      decideUpdate(policy, {
        websiteVersion: build.version,
        nativeVersion: ota.nativeVersion ?? null,
        otaVersion: ota.currentVersion ?? ota.builtinVersion ?? null,
        native,
        deviceId: getDeviceId(),
      }),
    [policy, build.version, ota.nativeVersion, ota.currentVersion, ota.builtinVersion, native]
  );

  // A mandatory OTA update is fetched through the existing verified pipeline;
  // nothing here bypasses the signature, checksum or activation gate.
  const otaRequired = decision.kind === 'mandatory_ota';
  useEffect(() => {
    if (!otaRequired || examBusy) return;
    let cancelled = false;
    void (async () => {
      try {
        await ota.initialize();
        if (cancelled) return;
        await ota.checkForUpdate(true);
        if (cancelled) return;
        const snapshot = ota.getSnapshot();
        if (snapshot.phase === 'staged') await ota.activate();
        setOtaAttempt((value) => value + 1);
      } catch {
        // A failed check is shown by the phase below; the user is never left
        // without a retry, and an APK link is offered when one is configured.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [otaRequired, examBusy, policy.min_ota_version, ota]);

  const reloadWebsite = () => {
    void (async () => {
      await purgeFrontendCaches();
      writePendingReload({
        targetBuildId: build.buildId,
        targetVersion: build.version,
        fromBuildId: build.buildId,
        at: Date.now(),
      });
      reloadFromNetwork({ location: window.location });
    })();
  };

  const apkUrl = decision.kind === 'mandatory_apk' || decision.kind === 'optional_update'
    ? decision.apkUrl
    : policy.apk_download_url || null;

  const currentNoticeId = globalNotice ? `${globalNotice.title}-${globalNotice.message}` : null;
  const showNotice = globalNotice && currentNoticeId !== dismissedNoticeId;

  if (isLoading && !configs) return <>{children}</>;

  if (maintenance.active) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center fixed inset-0 z-[9999] bg-app text-text-primary">
        <Wrench className="w-16 h-16 text-text-secondary mb-6" />
        <h1 className="text-3xl font-bold mb-4">{t('system.maintenanceTitle')}</h1>
        <p className="text-lg text-text-secondary">{maintenance.message || t('system.maintenanceFallback')}</p>
      </div>
    );
  }

  /**
   * Mandatory APK update. An exam in progress is never interrupted; the block
   * applies as soon as the exam is submitted.
   */
  if (decision.kind === 'mandatory_apk' && !examBusy) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center fixed inset-0 z-[9999] bg-app text-text-primary">
        <AlertTriangle className="w-16 h-16 text-amber-500 mb-6" />
        <h1 className="text-2xl font-bold mb-3">
          {decision.title || t('system.requiredUpdateTitle')}
        </h1>
        <p className="max-w-md text-base text-text-secondary mb-2">
          {decision.description || t('system.requiredUpdateBody')}
        </p>
        <p className="text-sm font-medium text-text-secondary mb-6">
          {t('system.requiredVersion', { version: decision.minVersion })}
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {apkUrl ? (
            <a
              href={apkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium bg-primary text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Download className="w-5 h-5" /> {t('system.downloadApk')}
            </a>
          ) : null}
          {ota.available ? (
            <button
              type="button"
              onClick={() => void ota.checkForUpdate(true)}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium border border-border-color text-text-primary"
            >
              <RefreshCw className="w-5 h-5" /> {t('system.updateNow')}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  /** Mandatory OTA update: never presented as an APK update. */
  if (decision.kind === 'mandatory_ota' && !examBusy) {
    const busy = ['checking', 'downloading', 'activating'].includes(ota.phase);

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center fixed inset-0 z-[9999] bg-app text-text-primary">
        {busy ? (
          <Loader2 className="w-16 h-16 text-primary mb-6 animate-spin" />
        ) : (
          <RefreshCw className="w-16 h-16 text-text-secondary mb-6" />
        )}
        <h1 className="text-2xl font-bold mb-3">
          {decision.title || t('system.requiredUpdateTitle')}
        </h1>
        <p className="max-w-md text-base text-text-secondary mb-2">
          {decision.description || t('system.otaRequiredBody')}
        </p>
        {!busy && ota.error ? (
          <p className="max-w-md text-sm text-amber-600 mb-2">{t('update.downloadFailed')}</p>
        ) : null}
        <p className="text-sm font-medium text-text-secondary mb-6">
          {t('system.requiredVersion', { version: decision.minVersion })}
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {ota.available && !busy ? (
            <button
              type="button"
              onClick={() => void ota.checkForUpdate(true)}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium bg-primary text-primary-foreground transition-opacity hover:opacity-90"
            >
              <RefreshCw className="w-5 h-5" /> {t('update.retry')}
            </button>
          ) : null}
          {!ota.available ? (
            <button
              type="button"
              onClick={reloadWebsite}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium bg-primary text-primary-foreground"
            >
              <RefreshCw className="w-5 h-5" /> {t('system.updateNow')}
            </button>
          ) : null}
          {apkUrl && !ota.available ? (
            <a
              href={apkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium border border-border-color text-text-primary"
            >
              <Download className="w-5 h-5" /> {t('system.downloadApk')}
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  /** Optional update: informational, dismissible, never blocks usage. */
  const optionalUpdate =
    decision.kind === 'optional_update' && decision.targetVersion !== dismissedUpdateVersion
      ? decision
      : null;

  return (
    <>
      {showNotice && (
        <div className="px-4 py-2.5 flex items-center justify-between z-50 relative shadow-md bg-primary text-primary-foreground">
          <div className="flex-1 text-sm">
            <strong>{globalNotice.title}:</strong> {globalNotice.message}
            {globalNotice.action_link && <a href={globalNotice.action_link} className="underline ml-2 hover:opacity-80">{t('system.noticeDetails')}</a>}
          </div>
          <button onClick={() => currentNoticeId && setDismissedNoticeId(currentNoticeId)} className="p-1 hover:bg-black/10 rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {optionalUpdate && (
        <div className="px-4 py-2.5 flex items-start gap-3 z-50 relative border-b border-border-color bg-surface-elevated text-text-primary">
          <Download className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">
              {optionalUpdate.title || t('system.optionalUpdateTitle')}
            </p>
            <p className="text-text-secondary mt-0.5">
              {optionalUpdate.description || t('system.optionalUpdateBody', { version: optionalUpdate.targetVersion })}
            </p>
            {optionalUpdate.apkUrl ? (
              <a
                href={optionalUpdate.apkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-1.5 text-xs font-semibold text-primary underline"
              >
                {t('system.downloadApk')}
              </a>
            ) : null}
          </div>
          <button
            onClick={() => setDismissedUpdateVersion(optionalUpdate.targetVersion)}
            className="p-1 hover:bg-black/10 rounded transition-colors"
            aria-label={t('update.dismiss')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {children}
    </>
  );
};

export default SystemGuard;
