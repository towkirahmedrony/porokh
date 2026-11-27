import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';

/**
 * One choice on the hub: a subject, a board, a college, a university or a whole
 * track. The count beside it is the server's number for exactly what the row
 * opens, so the row never promises more than the list delivers.
 */

interface HubRowProps {
  label: string;
  count?: number;
  href?: string;
  onClick?: () => void;
  /** Extra line under the label, for a rule the label cannot carry. */
  hint?: string;
  /** `primary` marks the goal section's rows; `quiet` mutes a secondary row. */
  tone?: 'primary' | 'quiet' | 'plain';
  trailing?: ReactNode;
}

const ROW_BASE =
  'flex min-h-[48px] w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors active:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

export function HubRow({
  label,
  count,
  href,
  onClick,
  hint,
  tone = 'plain',
  trailing,
}: HubRowProps) {
  const { language } = useLanguage();

  const content = (
    <>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-[13.5px] font-semibold ${
            tone === 'quiet' ? 'text-text-secondary' : 'text-text-primary'
          }`}
        >
          {label}
        </span>
        {hint && (
          <span className="mt-0.5 block text-[11px] font-medium leading-snug text-text-secondary">
            {hint}
          </span>
        )}
      </span>

      {trailing}

      {typeof count === 'number' && (
        <span className="shrink-0 text-[12px] font-bold tabular-nums text-text-secondary">
          {localizeDigits(count, language)}
        </span>
      )}

      {(href || onClick) && (
        <ChevronRight
          className="h-4 w-4 shrink-0 text-text-secondary"
          aria-hidden="true"
        />
      )}
    </>
  );

  if (href) {
    return (
      <Link to={href} className={ROW_BASE}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={ROW_BASE}>
        {content}
      </button>
    );
  }

  return <div className={ROW_BASE}>{content}</div>;
}

/**
 * Rows in one surface. Section content stays in one bordered container instead
 * of one card per row, which is what keeps the screen scannable at 360px.
 */
export function HubRowList({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`divide-y divide-border-color overflow-hidden rounded-2xl border border-card-border bg-card-bg ${className}`}
    >
      {children}
    </div>
  );
}
