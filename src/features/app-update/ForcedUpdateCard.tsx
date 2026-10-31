import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  Download,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Smartphone,
} from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import type { AppMessageKey } from '@/shared/i18n/messages';
import type { OtaBlockReason } from './types';
import type { ForcedUpdateOutcome } from './forcedUpdate';
import { describeBuild } from './buildInfo';
import { useForcedUpdate } from './useForcedUpdate';

const STAGE_MESSAGES = {
  checking: 'settings.updateChecking',
  downloading: 'settings.updateDownloading',
  activating: 'settings.updateActivating',
  reloading: 'settings.updateReloading',
} as const satisfies Record<string, AppMessageKey>;

const BLOCKING_REASONS: OtaBlockReason[] = [
  'pending_answers',
  'submission_pending',
  'attempt_unresolved',
  'recovery_in_progress',
];

const blockedMessage = (reasons: OtaBlockReason[]): AppMessageKey => {
  if (reasons.some((reason) => BLOCKING_REASONS.includes(reason))) {
    return 'settings.blockedPending';
  }
  if (reasons.includes('exam_active') || reasons.includes('exam_route')) {
    return 'settings.blockedExam';
  }
  if (reasons.includes('auth_unknown')) return 'update.blockedAuth';
  if (reasons.includes('storage_unavailable')) return 'update.blockedStorage';
  return 'settings.rejectedBody';
};

type Tone = 'success' | 'warning' | 'error' | 'info';

const toneClasses: Record<Tone, string> = {
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  error: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
  info: 'border-primary/30 bg-primary/10 text-text-primary',
};

const Card: React.FC<{ tone: Tone; icon: React.ReactNode; title: string; body?: string; children?: React.ReactNode }> = ({
  tone,
  icon,
  title,
  body,
  children,
}) => (
  <div className={`mt-3 rounded-xl border p-3 ${toneClasses[tone]}`} role="status" aria-live="polite">
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug">{title}</p>
        {body ? <p className="mt-1 text-xs leading-5 opacity-90">{body}</p> : null}
        {children}
      </div>
    </div>
  </div>
);

export const ForcedUpdateCard: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const {
    build,
    native,
    running,
    stage,
    progress,
    outcome,
    reloadOutcome,
    run,
    hardReload,
    reset,
    otaVersion,
    builtinVersion,
    canRestoreBuiltin,
    restoreBuiltin,
  } = useForcedUpdate();

  const [confirming, setConfirming] = useState<'check' | 'reload' | null>(null);
  const [restoreConfirming, setRestoreConfirming] = useState(false);

  const start = useCallback(async () => {
    const action = confirming;
    setConfirming(null);
    setRestoreConfirming(false);
    if (action === 'reload') await hardReload();
    else await run();
  }, [confirming, hardReload, run]);

  const outcomeCard = (result: ForcedUpdateOutcome) => {
    switch (result.kind) {
      case 'up_to_date':
        return (
          <Card
            tone="success"
            icon={<CheckCircle2 className="h-5 w-5" />}
            title={t('settings.upToDateTitle')}
            body={
              result.webAhead && result.remote
                ? t('settings.webAheadBody', { version: result.remote.version })
                : t('settings.reloadDoneBody', { version: describeBuild(result.build) })
            }
          />
        );

      case 'ota_staged':
        return (
          <Card
            tone="info"
            icon={<Download className="h-5 w-5" />}
            title={t('settings.otaStagedTitle')}
            body={t('settings.otaStagedBody', { version: result.version })}
          />
        );

      case 'ota_activated':
      case 'ota_restart_required':
        return (
          <Card
            tone="info"
            icon={<Loader2 className="h-5 w-5 animate-spin" />}
            title={t('settings.otaActivatedTitle', { version: result.version })}
          />
        );

      case 'reloaded':
        return (
          <Card
            tone="success"
            icon={<CheckCircle2 className="h-5 w-5" />}
            title={t('settings.updateReloading')}
          />
        );

      case 'apk_required': {
        const bodyKey: AppMessageKey = result.reason === 'native_incompatible'
          ? 'settings.apkRequiredNative'
          : 'settings.apkRequiredBundled';

        return (
          <Card
            tone="warning"
            icon={<Smartphone className="h-5 w-5" />}
            title={t('settings.apkRequiredTitle')}
            body={t(bodyKey, { version: result.remote?.version ?? result.build.version })}
          >
            <div className="mt-2 flex flex-wrap gap-2">
              {result.apkUrl ? (
                <a
                  href={result.apkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t('settings.downloadApk')}
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => navigate('/contact')}
                className="rounded-lg border border-current px-3 py-1.5 text-xs font-semibold"
              >
                {t('settings.contactSupport')}
              </button>
            </div>
          </Card>
        );
      }

      case 'blocked':
        return (
          <Card
            tone="warning"
            icon={<AlertTriangle className="h-5 w-5" />}
            title={t('update.blockedTitle')}
            body={t(blockedMessage(result.reasons))}
          />
        );

      case 'rejected':
        return (
          <Card
            tone="warning"
            icon={<ShieldAlert className="h-5 w-5" />}
            title={t('update.unsupported')}
            body={t('settings.rejectedBody')}
          />
        );

      case 'offline':
        return (
          <Card
            tone="warning"
            icon={<CloudOff className="h-5 w-5" />}
            title={t('settings.offlineTitle')}
            body={t('settings.offlineBody')}
          />
        );

      default:
        return (
          <Card
            tone="error"
            icon={<AlertTriangle className="h-5 w-5" />}
            title={t('settings.serverErrorTitle')}
            body={t('settings.serverErrorBody')}
          />
        );
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-elevated text-primary">
          <RefreshCw size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-primary">
            {t('settings.checkUpdates')}
          </p>
          <p className="mt-0.5 text-xs leading-5 text-text-secondary">
            {t('settings.checkUpdatesDescription')}
          </p>
          <p className="mt-1 text-xs font-medium text-text-secondary">
            {t('settings.currentBuild', { version: describeBuild(build) })}
          </p>
          {native && otaVersion && otaVersion !== build.version ? (
            <p className="mt-0.5 text-xs text-text-secondary">
              {t('settings.otaBundle', { version: otaVersion })}
            </p>
          ) : null}
          {native && builtinVersion && otaVersion && otaVersion !== builtinVersion ? (
            <p className="mt-0.5 text-xs text-text-secondary">
              {t('settings.builtinBuild', { version: builtinVersion })}
            </p>
          ) : null}
        </div>
      </div>

      {!confirming && !running ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              reset();
              setConfirming('check');
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {t('settings.checkUpdatesAction')}
          </button>
          <button
            type="button"
            onClick={() => {
              reset();
              setConfirming('reload');
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border-color px-3 py-2 text-sm font-semibold text-text-primary"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {t('settings.hardReloadAction')}
          </button>
        </div>
      ) : null}

      {confirming && !running ? (
        <div className="mt-3 rounded-xl border border-border-color bg-surface-elevated p-3">
          <p className="text-sm font-semibold text-text-primary">
            {t(confirming === 'reload' ? 'settings.hardReloadConfirmTitle' : 'settings.confirmTitle')}
          </p>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            {t(confirming === 'reload' ? 'settings.hardReloadConfirmBody' : 'settings.confirmBody')}
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className="rounded-lg border border-border-color px-3 py-1.5 text-xs font-medium text-text-secondary"
            >
              {t('settings.confirmCancel')}
            </button>
            <button
              type="button"
              onClick={() => void start()}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white"
            >
              {t(confirming === 'reload' ? 'settings.hardReloadConfirmAction' : 'settings.confirmYes')}
            </button>
          </div>
        </div>
      ) : null}

      {running ? (
        <div className="mt-3 rounded-xl border border-border-color bg-surface-elevated p-3" role="status" aria-live="polite">
          <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t(STAGE_MESSAGES[stage ?? 'checking'], { percent: progress })}
          </div>
          {stage === 'downloading' ? (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${Math.max(3, Math.min(100, progress))}%` }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {!running && reloadOutcome?.kind === 'verified' ? (
        <Card
          tone="success"
          icon={<CheckCircle2 className="h-5 w-5" />}
          title={t('settings.reloadDoneTitle')}
          body={t('settings.reloadDoneBody', {
            version: describeBuild(reloadOutcome.build),
          })}
        />
      ) : null}

      {!running && reloadOutcome?.kind === 'still_stale' ? (
        <Card
          tone="warning"
          icon={<AlertTriangle className="h-5 w-5" />}
          title={t('settings.reloadStaleTitle')}
          body={t('settings.reloadStaleBody')}
        />
      ) : null}

      {!running && outcome && !reloadOutcome ? outcomeCard(outcome) : null}

      {canRestoreBuiltin && !running ? (
        <div className="mt-3 border-t border-border-color pt-3">
          {restoreConfirming ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-text-secondary">{t('settings.restoreBuiltinHint')}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRestoreConfirming(false)}
                  className="rounded-lg border border-border-color px-3 py-1.5 text-xs font-medium text-text-secondary"
                >
                  {t('settings.confirmCancel')}
                </button>
                <button
                  type="button"
                  onClick={() => void restoreBuiltin()}
                  className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300"
                >
                  {t('settings.restoreConfirm')}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setRestoreConfirming(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary underline-offset-2 hover:underline"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              {t('settings.restoreBuiltin')}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default ForcedUpdateCard;
