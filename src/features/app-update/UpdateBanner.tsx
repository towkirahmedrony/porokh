import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  RotateCcw,
  X,
} from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { useOta } from './UpdateProvider';
import { REASON_MESSAGES, primaryReason } from './reasonMessages';
import { baseVersionOf } from './version';

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

const friendlyVersion = (version: string | null | undefined): string | null =>
  baseVersionOf(version) ?? version ?? null;

const Spinner = () => (
  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
);

export const UpdateBanner = () => {
  const { t } = useLanguage();
  const location = useLocation();
  const {
    available,
    phase,
    stagedVersion,
    latestVersion,
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
  const [entered, setEntered] = useState(false);
  const applyButtonRef = useRef<HTMLButtonElement>(null);

  const pendingVersion = stagedVersion ?? latestVersion;
  const friendly = friendlyVersion(pendingVersion);

  useEffect(() => {
    setHiddenVersion(null);
  }, [stagedVersion, latestVersion]);

  useEffect(() => {
    setEntered(false);
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [phase, stagedVersion, latestVersion]);

  useEffect(() => {
    if (applyButtonRef.current) applyButtonRef.current.focus();
  }, [phase, stagedVersion, latestVersion]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy && phase === 'staged') {
        if (pendingVersion) setHiddenVersion(pendingVersion);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busy, phase, pendingVersion]);

  const showModal =
    available &&
    !examActive &&
    location.pathname !== '/settings' &&
    !notice &&
    (phase === 'available' ||
      phase === 'downloading' ||
      phase === 'staged' ||
      phase === 'activation_blocked' ||
      phase === 'activating') &&
    Boolean(pendingVersion) &&
    hiddenVersion !== pendingVersion;

  useEffect(() => {
    if (!showModal || typeof document === 'undefined') return;
    const wasHidden = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = wasHidden;
    };
  }, [showModal]);

  const reason = primaryReason(reasons);

  const noticeContent = useMemo(() => {
    if (!notice) return null;
    if (notice.phase === 'activated') {
      return {
        icon: <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" aria-hidden="true" />,
        title: t('update.applied'),
        body: '',
        tone: 'success' as const,
        dismissible: false,
      };
    }
    if (notice.phase === 'recovery') {
      return {
        icon: <RotateCcw className="h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />,
        title: t('update.recoveryTitle'),
        body: t('update.recoveryBody', {
          version: friendlyVersion(notice.version) ?? notice.version,
        }),
        tone: 'warning' as const,
        dismissible: true,
      };
    }
    return {
      icon: <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />,
      title: t('update.failedTitle'),
      body: t(REASON_MESSAGES[notice.reasons?.[0] ?? 'activation_not_applied']),
      tone: 'warning' as const,
      dismissible: true,
    };
  }, [notice, t]);

  if (!available || examActive || location.pathname === '/settings') return null;

  if (notice && noticeContent) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`fixed left-1/2 top-4 z-[80] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 rounded-2xl border p-3 shadow-lg transition-[opacity,transform] duration-200 motion-reduce:transition-none ${entered ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'}`}
        style={cardStyle}
      >
        <div className="flex items-start gap-3">
          {noticeContent.icon}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug">{noticeContent.title}</p>
            {noticeContent.body ? (
              <p className="mt-0.5 text-xs leading-5 opacity-75">{noticeContent.body}</p>
            ) : null}
          </div>
          {noticeContent.dismissible ? (
            <button
              type="button"
              onClick={dismissNotice}
              className="touch-manipulation rounded-full p-1 opacity-60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dyn-primary,#2563eb)]"
              aria-label={t('update.dismiss')}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (
    (phase === 'available' ||
      phase === 'downloading' ||
      phase === 'staged' ||
      phase === 'activation_blocked' ||
      phase === 'activating') &&
    pendingVersion &&
    hiddenVersion !== pendingVersion
  ) {
    const blocked = reasons.length > 0 && (phase === 'staged' || phase === 'activation_blocked');
    const inProgress = phase === 'downloading' || phase === 'activating' || phase === 'available';
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ota-dialog-title"
          aria-describedby="ota-dialog-description"
          style={{ ...cardStyle, overscrollBehavior: 'contain' }}
          className={`relative w-full max-w-md rounded-3xl border p-6 text-center shadow-2xl transition-[opacity,transform] duration-200 motion-reduce:transition-none ${entered ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        >
          <span
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full text-[var(--dyn-primary,#2563eb)]"
            style={{ backgroundColor: 'color-mix(in srgb, var(--dyn-primary, #2563eb) 12%, transparent)' }}
          >
            {inProgress ? <Spinner /> : <ArrowDownCircle className="h-6 w-6" aria-hidden="true" />}
          </span>
          <h2 id="ota-dialog-title" className="mt-4 text-lg font-bold leading-snug text-balance">
            {t('update.availableTitle')}
          </h2>
          {friendly ? (
            <p
              translate="no"
              className="mx-auto mt-2 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-wide opacity-80"
              style={{ borderColor: 'color-mix(in srgb, var(--dyn-text, #0f172a) 15%, transparent)' }}
            >
              {t('update.availableVersion', { version: friendly })}
            </p>
          ) : null}
          {phase === 'downloading' ? (
            <div className="mt-3">
              <p id="ota-dialog-description" className="text-sm leading-relaxed opacity-80">
                {t('update.downloading', { percent: progress })}
              </p>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.max(0, Math.min(100, progress))}
                aria-label={t('update.downloading', { percent: progress })}
                className="mt-3 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/15"
              >
                <div
                  className="h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
                  style={{
                    width: `${Math.max(3, Math.min(100, progress))}%`,
                    backgroundColor: 'var(--dyn-primary, #2563eb)',
                  }}
                />
              </div>
            </div>
          ) : phase === 'activating' ? (
            <p id="ota-dialog-description" className="mt-3 text-sm leading-relaxed opacity-80">
              {t('update.activating')}
            </p>
          ) : blocked && reason ? (
            <div className="mt-3">
              <p id="ota-dialog-description" className="text-sm leading-relaxed opacity-80">
                {t(REASON_MESSAGES[reason])}
              </p>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-wide opacity-50">
                {t('update.blockedTitle')}
              </p>
            </div>
          ) : (
            <p id="ota-dialog-description" className="mt-3 text-sm leading-relaxed text-pretty opacity-80">
              {t('update.availableDescription')}
            </p>
          )}
          <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={() => setHiddenVersion(pendingVersion)}
              disabled={inProgress || busy}
              className="touch-manipulation inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border px-4 py-3 text-sm font-medium transition-colors duration-150 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dyn-primary,#2563eb)] disabled:cursor-not-allowed disabled:opacity-50"
              style={secondaryButtonStyle}
            >
              {t('update.later')}
            </button>
            <button
              ref={applyButtonRef}
              type="button"
              disabled={blocked || busy || inProgress}
              onClick={async () => {
                setBusy(true);
                try {
                  await activate();
                } finally {
                  setBusy(false);
                }
              }}
              className="touch-manipulation inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-opacity duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dyn-primary,#2563eb)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              style={primaryButtonStyle}
            >
              {busy || phase === 'activating' ? <Spinner /> : null}
              {t('update.applyNow')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'download_failed') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed left-1/2 top-4 z-[80] flex w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-2xl border p-3 shadow-lg"
        style={cardStyle}
      >
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-xs leading-5 opacity-80">
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
          className="touch-manipulation inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dyn-primary,#2563eb)] disabled:opacity-50"
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
        className="fixed left-1/2 top-4 z-[80] flex w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-2xl border p-3 shadow-lg"
        style={cardStyle}
      >
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-xs leading-5 opacity-80">
          {t(REASON_MESSAGES[primaryReason(reasons) ?? 'native_incompatible'])}
        </p>
        <button
          type="button"
          onClick={() => setHiddenVersion('rejected')}
          className="touch-manipulation shrink-0 rounded-full p-1 opacity-60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dyn-primary,#2563eb)]"
          aria-label={t('update.dismiss')}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return null;
};
