import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import { HUB_TONES, hubToneFromKey, type HubTone } from './hubTones';

/**
 * One square choice on the question bank hub: an exam track, a board, a college
 * or a subject.
 *
 * The hub is a wall of choices, so each one is a tile in a grid rather than a
 * full-width row: four or more fit on one screen instead of two, and a student
 * can compare counts without scrolling. The tint is one of the app's own
 * semantic colours at a low alpha, so a grid of these stays inside the product's
 * palette while still reading as a set of distinct choices.
 */
export function HubGridTile({
  href,
  label,
  meta,
  count,
  icon,
  badge,
  tone,
}: {
  href: string;
  label: string;
  /** A short second line, such as the English name or the institution code. */
  meta?: string | null;
  count?: number;
  /** A lucide icon for a category; `badge` is the letter fallback. */
  icon?: ReactNode;
  badge?: string;
  tone?: HubTone;
}) {
  const { t, language } = useLanguage();
  const initial = badge ?? Array.from(label.trim())[0] ?? '';
  const style = HUB_TONES[tone ?? hubToneFromKey(href)];

  return (
    <Link
      to={href}
      className={`!no-underline [text-decoration-line:none!important] relative flex min-h-[148px] touch-manipulation select-none flex-col items-center justify-center overflow-hidden rounded-[26px] border px-2.5 py-3.5 text-center transition-[transform,border-color] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring motion-reduce:transition-none ${style.card}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full ${style.shape}`}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -bottom-11 -left-9 h-24 w-24 rounded-full ${style.shape}`}
      />

      <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white text-[15px] font-extrabold leading-none text-slate-700 shadow-[0_2px_10px_rgba(15,23,42,0.10)] ring-1 ring-black/[0.04]">
        {icon ?? (
          <span className="font-['Noto_Sans_Bengali']" aria-hidden="true">
            {initial}
          </span>
        )}
      </span>

      <span className="relative mt-2 line-clamp-2 font-['Noto_Sans_Bengali'] text-[12.5px] font-extrabold leading-snug text-text-primary">
        {label}
      </span>

      {meta && (
        <span className="relative mt-1 max-w-full truncate text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
          {meta}
        </span>
      )}

      {typeof count === 'number' && (
        <span
          className={`relative mt-1.5 max-w-full truncate rounded-md px-2 py-0.5 text-[10px] font-bold tabular-nums text-text-primary/75 ${style.chip}`}
        >
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
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{children}</div>;
}