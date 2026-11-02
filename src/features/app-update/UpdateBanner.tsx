import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  RefreshCw,
  RotateCcw,
  X,
} from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { useOta } from './UpdateProvider';
import { REASON_MESSAGES, primaryReason } from './reasonMessages';

const cardStyle: CSSProperties = {
  backgroundColor: 'var(--dyn-card, #ffffff)',
  color: 'var(--dyn-text, #0f172a)',
  borderColor: 'color-mix(in srgb, var(--dyn-text, #0f172a) 12%, transparent)',
};

const primaryButtonStyle: CSSProperties = {
  backgroundColor: 'var(--dyn-primary, #2563eb)',
  color: '#ffffff',
};

const secondaryButtonStyle: CSSProperties = {
  borderColor: 'color-mix(in srgb, var(--dyn-text, #0f172a) 18%, transparent)',
  color: 'inherit',
};

const Spinner = () => (
  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
);

export const UpdateBanner = () => {
  const { t } = useLanguage();
  const {
    available,
    phase,
    stagedVersion,
    progress,
    reasons,
    notice,
    examActive,
    activate,
    checkForUpdate,
    dismissNotice,
  } = useOta();
  const [busy, setBusy] = useState(false);
  const [hiddenVersion, setHiddenVersion] = useState<string | null>(null);

  useEffect(() => {
    setHiddenVersion(null);
  }, [stagedVersion]);

  const reason = primaryReason(reasons);

  const noticeContent = useMemo(() => {
    if (!notice) return null;
    if (notice.phase === 'activated') {
      return {
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden="true" />,
        title: t('update.activated', { version: notice.version }),
        body: '',
        tone: 'success' as const,
      };
    }
    if (notice.phase === 'recovery') {
      return {
        icon: <RotateCcw className="h-5 w-5 text-amber-500" aria-hidden="true" />,
        title: t('update.recoveryTitle'),
        body: t('update.recoveryBody', { version: notice.version }),
        tone: 'warning' as const,
      };
    }
    return {
      icon: <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />,
      title: t('update.failedTitle'),
      body: t(REASON_MESSAGES[notice.reasons?.[0] ?? 'activation_not_applied']),
      tone: 'warning' as const,
    };
  }, [notice, t]);

  if (!available || examActive) return null;

  if (notice && noticeContent) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-3 bottom-20 z-[70] rounded-2xl border p-3 shadow-lg sm:bottom-4 sm:left-auto sm:right-4 sm:w-[380px]"
        style={cardStyle}
      >
        <div className="flex items-start gap-3">
          {noticeContent.icon}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug">{noticeContent.title}</p>
            {noticeContent.body ? (
              <p className="mt-0.5 text-xs opacity-75">{noticeContent.body}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={dismissNotice}
            className="rounded-full p-1 opacity-60 hover:opacity-100"
            aria-label={t('update.dismiss')}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'downloading') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-3 bottom-20 z-[70] rounded-2xl border p-3 shadow-lg sm:bottom-4 sm:left-auto sm:right-4 sm:w-[380px]"
        style={cardStyle}
      >
        <div className="flex items-start gap-3">
          <Download className="h-5 w-5 shrink-0 text-blue-500" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {t('update.downloading', { percent: progress })}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{
                  width: `${progress}%`,
                  backgroundColor: 'var(--dyn-primary, #2563eb)',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'activating') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-3 bottom-20 z-[70] flex items-center gap-3 rounded-2xl border p-3 shadow-lg sm:bottom-4 sm:left-auto sm:right-4 sm:w-[380px]"
        style={cardStyle}
      >
        <Spinner />
        <p className="text-sm font-medium">{t('update.activating')}</p>
      </div>
    );
  }

  if (
    (phase === 'staged' || phase === 'activation_blocked') &&
    stagedVersion &&
    hiddenVersion !== stagedVersion
  ) {
    const blocked = reasons.length > 0;
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-3 bottom-20 z-[70] rounded-2xl border p-3 shadow-lg sm:bottom-4 sm:left-auto sm:right-4 sm:w-[380px]"
        style={cardStyle}
      >
        <div className="flex items-start gap-3">
          <Download className="h-5 w-5 shrink-0 text-blue-500" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t('update.availableTitle')}</p>
            <p className="mt-0.5 text-xs opacity-75">
              {blocked && reason
                ? t(REASON_MESSAGES[reason])
                : t('update.availableBody', { version: stagedVersion })}
            </p>
            {blocked ? (
              <p className="mt-1 text-[11px] font-medium uppercase tracking-wide opacity-50">
                {t('update.blockedTitle')}
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setHiddenVersion(stagedVersion)}
            className="rounded-lg border px-3 py-1.5 text-xs font-medium"
            style={secondaryButtonStyle}
          >
            {t('update.later')}
          </button>
          <button
            type="button"
            disabled={blocked || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await activate();
              } finally {
                setBusy(false);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            style={primaryButtonStyle}
          >
            {busy ? <Spinner /> : null}
            {t('update.applyNow')}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'download_failed') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-3 bottom-20 z-[70] flex items-center gap-3 rounded-2xl border p-3 shadow-lg sm:bottom-4 sm:left-auto sm:right-4 sm:w-[380px]"
        style={cardStyle}
      >
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-xs opacity-80">
          {t('update.downloadFailed')}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await checkForUpdate(true);
            } finally {
              setBusy(false);
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium disabled:opacity-50"
          style={secondaryButtonStyle}
        >
          {busy ? <Spinner /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
          {t('update.retry')}
        </button>
      </div>
    );
  }

  if (
    phase === 'rejected' &&
    hiddenVersion !== 'rejected' &&
    reasons.some(
      (item) => item === 'storage_schema_incompatible' || item === 'native_incompatible'
    )
  ) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-3 bottom-20 z-[70] flex items-center gap-3 rounded-2xl border p-3 shadow-lg sm:bottom-4 sm:left-auto sm:right-4 sm:w-[380px]"
        style={cardStyle}
      >
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-xs opacity-80">
          {t(REASON_MESSAGES[primaryReason(reasons) ?? 'native_incompatible'])}
        </p>
        <button
          type="button"
          onClick={() => setHiddenVersion('rejected')}
          className="rounded-full p-1 opacity-60 hover:opacity-100"
          aria-label={t('update.dismiss')}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return null;
};
