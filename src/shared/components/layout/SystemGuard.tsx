import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, Wrench, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/shared/lib/apiClient';
import { useLocalStorage } from '@/shared/hooks/useLocalStorage';
import { STORAGE_KEYS } from '@/shared/constants/storageKeys';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { pickLang } from '@/shared/i18n/localize';
import { getExamActivities, subscribeExamActivity } from '@/features/app-update/examActivity';
import { isExamBusy } from '@/features/app-update/activationGate';
import { currentBuild } from '@/features/app-update/buildInfo';
import { purgeFrontendCaches, reloadFromNetwork, writePendingReload } from '@/features/app-update/cacheRecovery';
import { Capacitor } from '@capacitor/core';
import { useOta } from '@/features/app-update/UpdateProvider';

const APP_VERSION = import.meta.env.VITE_APP_VERSION || "1.0.0";

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
  is_force_update_required?: boolean;
  min_app_version?: string;
}

interface SystemGuardProps {
  children: React.ReactNode;
}

export const SystemGuard: React.FC<SystemGuardProps> = ({ children }) => {
  const { language, t } = useLanguage();
  const location = useLocation();
  const ota = useOta();
  const [, setActivityRevision] = useState(0);
  useEffect(() => subscribeExamActivity(() => setActivityRevision((value) => value + 1)), []);
  const examBusy = isExamBusy(getExamActivities(), location.pathname);
  const [dismissedNoticeId, setDismissedNoticeId] = useLocalStorage<string | null>(STORAGE_KEYS.DISMISSED_NOTICE, null);

  const { data: configs, isLoading } = useQuery<SystemConfig[]>({
    queryKey: ['system-configs'],
    queryFn: async () => {
      const response = await apiClient.get('/system/configs');
      return response.data?.data || [];
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  const { maintenance, forceUpdate, globalNotice } = useMemo(() => {
    let maintenance = { active: false, message: '' };
    let forceUpdate = false;
    let globalNotice: GlobalNotice | null = null;

    if (configs) {
      const globalConfig = configs.find((c) => c.key === 'global_settings');
      if (globalConfig) {
        if (globalConfig.maintenance_mode) {
          maintenance = {
            active: true,
            message: pickLang(language, globalConfig.maintenance_message, globalConfig.maintenance_message_en),
          };
        }
        if (globalConfig.is_force_update_required) {
          const minVer = globalConfig.min_app_version || '0.0.0';
          if (minVer.localeCompare(APP_VERSION, undefined, { numeric: true, sensitivity: 'base' }) > 0) {
            forceUpdate = true;
          }
        }
      }

      const noticeConfig = configs.find((c) => c.key === 'global_notice');
      if (noticeConfig?.value?.is_active) {
        globalNotice = noticeConfig.value;
      }
    }

    return { maintenance, forceUpdate, globalNotice };
  }, [configs, language]);

  const handleUpdate = async () => {
    if (isExamBusy(getExamActivities(), window.location.pathname)) return;
    if (Capacitor.isNativePlatform()) {
      try {
        await ota.initialize();
        if (ota.getSnapshot().available) {
          const reloaded = await ota.reloadCurrent();
          if (reloaded || isExamBusy(getExamActivities(), window.location.pathname)) return;
        }
      } catch {
        // A plugin failure must not block the WebView reload fallback.
      }
    }
    await purgeFrontendCaches();
    const build = currentBuild();
    writePendingReload({
      targetBuildId: build.buildId,
      targetVersion: build.version,
      fromBuildId: build.buildId,
      at: Date.now(),
    });
    reloadFromNetwork({ location: window.location });
  };

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

  if (forceUpdate && !examBusy) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center fixed inset-0 z-[9999] bg-app text-text-primary">
        <AlertTriangle className="w-16 h-16 text-text-secondary mb-6" />
        <h1 className="text-3xl font-bold mb-4">{t('system.forceUpdateTitle')}</h1>
        <button onClick={handleUpdate} className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium bg-primary text-primary-foreground transition-opacity hover:opacity-90">
          <RefreshCw className="w-5 h-5" /> {t('system.updateNow')}
        </button>
      </div>
    );
  }

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
      {children}
    </>
  );
};

export default SystemGuard;
