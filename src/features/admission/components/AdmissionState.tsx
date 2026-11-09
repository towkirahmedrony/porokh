import React from 'react';
import { AlertCircle, Inbox, SearchX } from 'lucide-react';

interface AdmissionStateProps {
  title: string;
  message?: string;
  variant?: 'empty' | 'error' | 'not-found' | 'missing-data';
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

const ICONS = {
  empty: Inbox,
  'not-found': SearchX,
  'missing-data': Inbox,
  error: AlertCircle,
};

export const AdmissionState: React.FC<AdmissionStateProps> = ({
  title,
  message,
  variant = 'empty',
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}) => {
  const Icon = ICONS[variant];
  const iconClass =
    variant === 'error' ? 'text-danger' : 'text-text-secondary';

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-card-border bg-card-bg px-5 py-12 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface">
        <Icon className={`h-8 w-8 ${iconClass}`} aria-hidden="true" />
      </div>

      <h2 className="mb-2 font-['Noto_Sans_Bengali'] text-lg font-semibold text-text-primary">
        {title}
      </h2>

      {message && (
        <p className="mb-6 max-w-sm font-['Noto_Sans_Bengali'] text-sm leading-relaxed text-text-secondary">
          {message}
        </p>
      )}

      {(actionLabel || secondaryLabel) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {actionLabel}
            </button>
          )}

          {secondaryLabel && onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              className="rounded-xl border border-border-color bg-surface px-5 py-2.5 text-sm font-semibold text-text-primary transition-all hover:bg-surface-elevated active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
