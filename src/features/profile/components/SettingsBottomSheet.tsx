import React, { useEffect, useRef } from 'react';
import { useBackInterceptor } from '@/app/navigation/useBackInterceptor';

interface SettingsBottomSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Native-feeling modal bottom sheet for selectable preferences.
 * Bottom anchored on phones, centred dialog on larger screens, with scrim
 * tap, Escape and Android Back dismissal.
 */
export const SettingsBottomSheet: React.FC<SettingsBottomSheetProps> = ({
  open,
  title,
  onClose,
  children,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<Element | null>(null);

  useBackInterceptor(onClose, open);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement;
    dialogRef.current
      ?.querySelector<HTMLElement>('button, [href], [tabindex]')
      ?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused.current instanceof HTMLElement) {
        previouslyFocused.current.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-in fade-in duration-200 motion-reduce:animate-none sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl shadow-xl animate-in slide-in-from-bottom-4 fade-in duration-200 motion-reduce:animate-none sm:rounded-3xl bg-card-bg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1 w-8 rounded-full bg-border-color sm:hidden" aria-hidden="true" />
        <h2 className="px-5 pb-2 pt-4 text-base font-semibold leading-6 text-text-primary">
          {title}
        </h2>
        <div className="pb-4">{children}</div>
      </div>
    </div>
  );
};

interface SheetRadioRowProps {
  checked: boolean;
  onSelect: () => void;
  label: string;
  lang?: string;
  icon?: React.ReactNode;
}

/** Single-choice row with a Material 3 radio indicator. */
export const SheetRadioRow: React.FC<SheetRadioRowProps> = ({
  checked,
  onSelect,
  label,
  lang,
  icon,
}) => (
  <button
    type="button"
    role="radio"
    aria-checked={checked}
    lang={lang}
    onClick={onSelect}
    className="flex min-h-[56px] w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-elevated/70 active:bg-surface-elevated focus-visible:outline-none focus-visible:bg-surface-elevated"
  >
    <span
      aria-hidden="true"
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2"
      style={{ borderColor: checked ? 'var(--primary)' : 'var(--text-secondary)', opacity: checked ? 1 : 0.6 }}
    >
      {checked ? <span className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
    </span>
    {icon ? <span className="shrink-0 text-text-secondary">{icon}</span> : null}
    <span
      className={`min-w-0 flex-1 text-[15px] leading-6 text-text-primary ${checked ? 'font-medium' : ''}`}
    >
      {label}
    </span>
  </button>
);

export default SettingsBottomSheet;
