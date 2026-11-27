import { useEffect } from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import type { QuestionBankHubRow } from '../../types/questionBankHub';
import { HubRow } from './HubRow';

/**
 * "বিষয় অনুযায়ী" on the admission hub.
 *
 * Ten admission subjects do not fit under the university rows without pushing
 * the rest of the hub off screen, and each one is a whole-list choice rather
 * than a step in a drill-down. A sheet keeps the hub short and gives the
 * subject counts room to be read.
 */
export function HubSubjectSheet({
  open,
  rows,
  onClose,
  onSelect,
}: {
  open: boolean;
  rows: QuestionBankHubRow[];
  onClose: () => void;
  onSelect: (subjectId: string) => void;
}) {
  const { t, language } = useLanguage();

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label={t('questionBank.hub.closeSubjects')}
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('questionBank.hub.bySubject')}
        className="relative flex max-h-[75vh] w-full max-w-lg flex-col rounded-t-[24px] border-t border-border-color bg-app"
      >
        <div className="flex items-center justify-between border-b border-border-color px-4 py-3">
          <h2 className="text-sm font-bold text-text-primary">
            {t('questionBank.hub.bySubject')}
          </h2>
          <span className="text-[11px] font-medium text-text-secondary">
            {localizeDigits(rows.length, language)}
          </span>
        </div>

        <div className="overflow-y-auto px-3 py-3">
          <div className="divide-y divide-border-color overflow-hidden rounded-2xl border border-card-border bg-card-bg">
            {rows.map((row) => (
              <HubRow
                key={row.id}
                label={row.labelBn}
                count={row.count}
                onClick={() => onSelect(row.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
