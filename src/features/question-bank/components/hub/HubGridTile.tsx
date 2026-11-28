import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';

/**
 * One square choice on the question bank hub: an exam track, a board, a college
 * or a subject.
 *
 * The hub is a wall of choices, so each one is a tile in a grid rather than a
 * full-width row: four or more fit on one screen instead of two, and a student
 * can compare counts without scrolling. The palette stays the app's own — one
 * primary tint on the badge and nothing per item — so the grid reads as one
 * surface instead of a colour chart.
 */
export function HubGridTile({
  href,
  label,
  meta,
  count,
  icon,
  badge,
  tone = 'plain',
}: {
  href: string;
  label: string;
  /** A short second line, such as the English name or the institution code. */
  meta?: string | null;
  count?: number;
  /** A lucide icon for a category; `badge` is the letter fallback. */
  icon?: ReactNode;
  badge?: string;
  tone?: 'plain' | 'primary';
}) {
  const { t, language } = useLanguage();
  const initial = badge ?? Array.from(label.trim())[0] ?? '';

  return (
    <Link
      to={href}
      className={`!no-underline [text-decoration-line:none!important] flex min-h-[124px] touch-manipulation select-none flex-col items-center justify-center gap-1 rounded-[20px] border px-2.5 py-3.5 text-center transition-[transform,border-color] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring motion-reduce:transition-none ${
        tone === 'primary'
          ? 'border-primary/25 bg-primary/[0.05] hover:border-primary/45'
          : 'border-card-border bg-card-bg hover:border-primary/35'
      }`}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-[15px] font-extrabold leading-none text-primary">
        {icon ?? (
          <span className="font-['Noto_Sans_Bengali']" aria-hidden="true">
            {initial}
          </span>
        )}
      </span>

      <span className="mt-1 line-clamp-2 font-['Noto_Sans_Bengali'] text-[12.5px] font-bold leading-snug text-text-primary">
        {label}
      </span>

      {meta && (
        <span className="max-w-full truncate text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
          {meta}
        </span>
      )}

      {typeof count === 'number' && (
        <span className="max-w-full truncate text-[10.5px] font-medium tabular-nums text-text-secondary">
          {t('questionBank.hub.questionMeta', {
            count: localizeDigits(count, language),
          })}
        </span>
      )}
    </Link>
  );
}

/** The tile grid. Two columns on a phone, more wherever there is room. */
export function HubGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
      {children}
    </div>
  );
}
