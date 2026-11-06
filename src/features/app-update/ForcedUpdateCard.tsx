import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Smartphone,
} from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { QUERY_KEYS } from '@/shared/constants/storageKeys';
import apiClient from '@/shared/lib/apiClient';
import { getDeviceId } from '@/shared/utils/device';
import { getNativeVersion } from '@/shared/utils/nativeVersion';
import { useOta } from './UpdateProvider';
import { REASON_MESSAGES, primaryReason } from './reasonMessages';
import { decideUpdate, normalizeUpdatePolicy } from './versionPolicy';
import { currentBuild } from './buildInfo';
import { OtaDiagnosticsPanel } from './OtaDiagnosticsPanel';

type ConfigRow = { key: string; value?: unknown };

/**
 * The single user-facing App Updates panel.
 *
 * It only ever talks about the installed Capacitor app: the website is served
 * fresh by the deployment, so there is no website update to offer here. Every
 * action goes through the existing OTA controller — the signed GitHub release
 * pointer, checksum verification, activation gate and rollback are unchanged.
 *
 * "Check for updates" resolves the newest signed release for this channel and
 * downloads it when it is newer; "Download and install" then activates the
 * staged bundle once the exam-aware gate allows it.
 */
export const ForcedUpdateCard: React.FC = () => {
  const { t } = useLanguage();
  const ota = useOta();

  const [nativeVersion, setNativeVersion] = useState<string | null>(null);
  const [action, setAction] = useState<'check' | 'install' | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getNativeVersion().then((version) => {
      if (!cancelled) setNativeVersion(version);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Same query as SystemGuard, so the policy is read once and shared.
  const { data: configs } = useQuery<ConfigRow[]>({
    queryKey: QUERY_KEYS.SYSTEM_CONFIGS,
    queryFn: async () => {
      const response = await apiClient.get('/system/configs');
      return (response.data?.data ?? []) as ConfigRow[];
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  const policy = useMemo(
    () => normalizeUpdatePolicy(configs?.find((row) => row.key === 'update_policy')?.value),
    [configs]
  );

  /** Mandatory APK checks reuse the same decision logic as SystemGuard. */
  const decision = useMemo(
    () =>
      decideUpdate(policy, {
        websiteVersion: currentBuild().version,
        nativeVersion,
        otaVersion: ota.currentVersion ?? ota.builtinVersion ?? null,
        native: true,
        deviceId: getDeviceId(),
      }),
    [policy, nativeVersion, ota.currentVersion, ota.builtinVersion]
  );

  const apkUrl =
    decision.kind === 'mandatory_apk'
      ? decision.apkUrl
      : policy.apk_download_url || null;

  const latestOtaVersion = ota.latestVersion;

  const checking = ota.phase === 'checking';
  const downloading = ota.phase === 'available' || ota.phase === 'downloading';
  const installing = ota.phase === 'staged' || ota.phase === 'activation_blocked';
  const running = checking || downloading || ota.phase === 'activating';

  const blockedReasons = installing
    ? ota.reasons.filter((reason) => reason !== 'exam_active')
    : [];
  const blocked = blockedReasons.length > 0;

  const checkForUpdates = useCallback(async () => {
    setAction('check');
    try {
      await ota.checkForUpdate(true);
    } finally {
      setAction(null);
    }
  }, [ota]);

  const installDownloaded = useCallback(async () => {
    setAction('install');
    try {
      await ota.activate();
    } finally {
      setAction(null);
    }
  }, [ota]);

  const statusCopy = useMemo((): { tone: 'neutral' | 'info' | 'success' | 'warning' | 'error'; title: string; body?: string } => {
    switch (ota.phase) {
      case 'disabled':
        return { tone: 'warning', title: t('settings.otaUnavailable') };
      case 'checking':
        return { tone: 'info', title: t('settings.updateChecking') };
      case 'available':
      case 'downloading':
        return {
          tone: 'info',
          title: t('settings.updateDownloading', { percent: ota.progress }),
        };
      case 'staged':
      case 'activation_blocked':
        return blocked
          ? {
              tone: 'warning',
              title: t('update.blockedTitle'),
              body: t(REASON_MESSAGES[primaryReason(blockedReasons) ?? 'activation_not_applied']),
            }
          : {
              tone: 'info',
              title: t('settings.otaStagedTitle'),
              body: ota.stagedVersion
                ? t('settings.otaStagedBody', { version: ota.stagedVersion })
                : undefined,
            };
      case 'activating':
        return { tone: 'info', title: t('settings.updateActivating') };
      case 'activated':
        return {
          tone: 'success',
          title: t('settings.otaActivatedTitle', { version: ota.currentVersion ?? '' }),
        };
      case 'up_to_date':
        return { tone: 'success', title: t('settings.upToDateTitle') };
      case 'check_failed':
        return {
          tone: 'error',
          title: t('settings.serverErrorTitle'),
          body: t('settings.serverErrorBody'),
        };
      case 'download_failed':
        return { tone: 'warning', title: t('update.downloadFailed') };
      case 'rejected':
        return {
          tone: 'warning',
          title: t('update.unsupported'),
          body: ota.reasons.length > 0
            ? t(REASON_MESSAGES[primaryReason(ota.reasons) ?? 'metadata_invalid'])
            : t('settings.rejectedBody'),
        };
      case 'activation_failed':
        return { tone: 'warning', title: t('update.failedTitle') };
      case 'recovery':
        return { tone: 'warning', title: t('update.recoveryTitle') };
      default:
        return { tone: 'neutral', title: t('settings.checkUpdatesDescription') };
    }
  }, [ota.phase, ota.progress, ota.stagedVersion, ota.currentVersion, ota.reasons, blocked, blockedReasons, t]);

  const toneClasses = {
    neutral: 'border-border-color bg-surface-elevated text-text-secondary',
    info: 'border-primary/30 bg-primary/10 text-text-primary',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    error: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
  } as const;

  const versionRow = (label: string, value: string | null) => (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-[13px] leading-5 text-text-secondary break-words">{label}</span>
      <span className="shrink-0 text-[13px] leading-5 font-medium tabular-nums text-text-primary">
        {value || t('settings.unknownVersion')}
      </span>
    </div>
  );

  return (
    <div className="p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center text-text-secondary">
          <Smartphone size={22} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-6 font-medium text-text-primary">
            {t('settings.checkUpdates')}
          </p>
          <p className="mt-0.5 text-[13px] leading-[1.5] text-text-secondary break-words">
            {t('settings.checkUpdatesDescription')}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-surface-elevated/50 px-3 py-1">
        {versionRow(t('settings.apkVersionLabel'), nativeVersion)}
        {versionRow(t('settings.otaInstalledLabel'), ota.currentVersion)}
        {latestOtaVersion && latestOtaVersion !== ota.currentVersion
          ? versionRow(t('settings.otaLatestLabel'), latestOtaVersion)
          : null}
      </div>

      {decision.kind === 'mandatory_apk' ? (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300" role="status">
          <div className="flex items-start gap-2.5">
            <Smartphone className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t('settings.apkRequiredTitle')}</p>
              <p className="mt-1 text-xs leading-5">
                {t('settings.apkRequiredNative', { version: decision.minVersion })}
              </p>
              {apkUrl ? (
                <a
                  href={apkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity active:opacity-80 sm:hover:opacity-90"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('settings.downloadApk')}
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className={`mt-3 rounded-2xl border p-3 ${toneClasses[statusCopy.tone]}`} role="status" aria-live="polite">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 shrink-0">
            {running ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : statusCopy.tone === 'success' ? (
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            ) : statusCopy.tone === 'warning' ? (
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            ) : statusCopy.tone === 'error' ? (
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-5 w-5" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug">{statusCopy.title}</p>
            {statusCopy.body ? (
              <p className="mt-1 text-xs leading-5 opacity-90">{statusCopy.body}</p>
            ) : null}
            {downloading ? (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300"
                  style={{ width: `${Math.max(3, Math.min(100, ota.progress))}%` }}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void checkForUpdates()}
          disabled={!ota.available || running || ota.examActive || action !== null}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity active:opacity-80 sm:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {checking ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          )}
          {t('settings.checkUpdatesAction')}
        </button>

        {ota.available && (installing || ota.stagedVersion) ? (
          <button
            type="button"
            onClick={() => void installDownloaded()}
            disabled={running || blocked || ota.examActive || action !== null}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full border border-border-color px-4 py-2 text-sm font-medium text-text-primary transition-colors active:bg-surface-elevated sm:hover:bg-surface-elevated/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {action === 'install' ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            {t('settings.otaInstallAction')}
          </button>
        ) : null}
      </div>

      {ota.available && ota.currentVersion && ota.builtinVersion && ota.currentVersion !== ota.builtinVersion && !running ? (
        <div className="mt-3 border-t border-border-color pt-3">
          <button
            type="button"
            onClick={() => void ota.restoreBuiltin()}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary underline-offset-2 hover:underline"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            {t('settings.restoreBuiltin')}
          </button>
        </div>
      ) : null}

      <OtaDiagnosticsPanel currentBuild={nativeVersion ? `APK ${nativeVersion}` : 'APK'} />
    </div>
  );
};

export default ForcedUpdateCard;
