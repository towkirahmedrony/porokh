import { useEffect, useState } from 'react';
import { Bug, ChevronDown, ChevronUp, Copy, Trash2 } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import {
  clearOtaDiagnosticEntries,
  formatOtaDiagnosticEntries,
  getOtaDiagnosticEntries,
  recordOtaDiagnostic,
  subscribeOtaDiagnosticEntries,
  type OtaDiagnosticEntry,
} from './diagnostics';

export const OtaDiagnosticsPanel: React.FC<{ currentBuild: string }> = ({
  currentBuild,
}) => {
  const { t } = useLanguage();
  const [entries, setEntries] = useState<OtaDiagnosticEntry[]>(
    getOtaDiagnosticEntries
  );
  const [open, setOpen] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const logText = formatOtaDiagnosticEntries(entries);

  useEffect(
    () => subscribeOtaDiagnosticEntries(setEntries),
    []
  );

  useEffect(() => {
    recordOtaDiagnostic('info', 'diagnostic_panel_loaded', { currentBuild });
  }, [currentBuild]);

  const copyLogs = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(logText || t('settings.otaDiagnosticEmpty'));
      setCopyState('copied');
    } catch {
      const textarea = document.getElementById(
        'porokh-ota-diagnostic-log'
      ) as HTMLTextAreaElement | null;
      if (textarea) {
        textarea.focus();
        textarea.select();
        try {
          if (document.execCommand('copy')) {
            setCopyState('copied');
            return;
          }
        } catch {
          // The visible read-only log remains available for long-press selection.
        }
      }
      setCopyState('manual');
    }
  };

  const clearLogs = () => {
    clearOtaDiagnosticEntries();
    setCopyState('idle');
  };

  return (
    <section className="mt-4 border-t border-border-color pt-3" aria-label={t('settings.otaDiagnosticTitle')}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 rounded-lg py-2 text-left text-sm font-medium text-text-secondary"
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <Bug className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span>{t('settings.otaDiagnosticToggle', { count: entries.length })}</span>
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
        )}
      </button>

      {open ? (
        <div className="mt-2 rounded-xl border border-border-color bg-surface-elevated p-3">
          <p className="text-xs leading-5 text-text-secondary">
            {t('settings.otaDiagnosticPrivacy')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyLogs()}
              disabled={entries.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              {copyState === 'copied'
                ? t('settings.otaDiagnosticCopied')
                : t('settings.otaDiagnosticCopy')}
            </button>
            <button
              type="button"
              onClick={clearLogs}
              disabled={entries.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-color px-3 py-1.5 text-xs font-medium text-text-secondary disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t('settings.otaDiagnosticClear')}
            </button>
          </div>
          {copyState === 'manual' ? (
            <p className="mt-2 text-xs text-text-secondary">
              {t('settings.otaDiagnosticCopyManual')}
            </p>
          ) : null}
          {entries.length === 0 ? (
            <p className="mt-3 text-xs text-text-secondary">
              {t('settings.otaDiagnosticEmpty')}
            </p>
          ) : (
            <textarea
              id="porokh-ota-diagnostic-log"
              readOnly
              rows={10}
              value={logText}
              aria-label={t('settings.otaDiagnosticTitle')}
              className="mt-3 w-full resize-y rounded-lg border border-border-color bg-background p-2 font-mono text-[10px] leading-4 text-text-primary"
            />
          )}
        </div>
      ) : null}
    </section>
  );
};

export default OtaDiagnosticsPanel;
