import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import UniversityLogo from '@/features/admission/components/UniversityLogo';
import { HUB_TONES, type HubTone } from './hubTones';

/**
 * A tinted card with an institution logo on a white disc: the shape the
 * question bank uses for a college, a university or one of its units.
 *
 * The logo sits on white in both themes so the universities' own marks keep
 * their colours, which is the same rule the admission grid follows. Everything
 * else — the tint, the soft circles, the radius — comes from the app's palette,
 * so a wall of these reads as this product's bank rather than a copy of another
 * site's rainbow.
 */
export function HubLogoTile({
  label,
  meta,
  logoUrl,
  shortName,
  tone,
  href,
  onClick,
  selected = false,
}: {
  label: string;
  /** The count line under the name, already localised. */
  meta: string;
  logoUrl?: string | null;
  /** A short code shown in a pill under the name, e.g. an institution's initials. */
  shortName?: string | null;
  tone: HubTone;
  href?: string;
  onClick?: () => void;
  /** Marks the unit whose year list is on screen. */
  selected?: boolean;
}) {
  const style = HUB_TONES[tone];

  const content: ReactNode = (
    <>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -right-9 -top-11 h-28 w-28 rounded-full ${style.shape}`}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -bottom-12 -left-10 h-28 w-28 rounded-full ${style.shape}`}
      />

      <span className="relative flex h-[58px] w-[58px] items-center justify-center rounded-full bg-white shadow-[0_2px_10px_rgba(15,23,42,0.10)] ring-1 ring-black/[0.04]">
        <UniversityLogo
          logoUrl={logoUrl ?? null}
          name={label}
          shortName={shortName}
          variant="plain"
          className="h-[46px] w-[46px] rounded-full"
          imageClassName="h-8 w-8"
        />
        {selected && (
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-app">
            <Check className="h-3 w-3" aria-hidden="true" strokeWidth={3} />
          </span>
        )}
      </span>

      <span className="relative mt-2 line-clamp-2 font-['Noto_Sans_Bengali'] text-[13px] font-extrabold leading-snug text-text-primary">
        {label}
      </span>

      {shortName && (
        <span
          className={`relative mt-1.5 max-w-full truncate rounded-md px-2 py-0.5 text-[10px] font-bold text-text-primary/75 ${style.chip}`}
        >
          {shortName}
        </span>
      )}

      <span className="relative mt-1 max-w-full truncate text-[10.5px] font-semibold tabular-nums text-text-secondary">
        {meta}
      </span>
    </>
  );

  const className = `relative flex min-h-[164px] touch-manipulation select-none flex-col items-center justify-center overflow-hidden rounded-[26px] border px-3 py-4 text-center transition-[transform,border-color] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring motion-reduce:transition-none ${
    selected ? 'border-primary ring-2 ring-primary' : style.card
  }`;

  if (href) {
    return (
      <Link to={href} className={`!no-underline [text-decoration-line:none!important] ${className}`}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={className}>
      {content}
    </button>
  );
}