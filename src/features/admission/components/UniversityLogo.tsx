import React, { useEffect, useState } from 'react';

interface UniversityLogoProps {
  logoUrl: string | null;
  name: string;
  shortName?: string | null;
  className?: string;
  imageClassName?: string;
  /**
   * `plain` drops the teal tile for a surface that supplies its own: the
   * question bank's logo tiles draw a white disc and put the logo inside it.
   */
  variant?: 'tint' | 'plain';
}

/**
 * Institution logo in the soft teal tile used by the admission grids.
 *
 * A missing, broken or not-yet-populated `logo_url` falls back to the
 * institution's initials so a card never shows a broken image.
 */
const UniversityLogo: React.FC<UniversityLogoProps> = ({
  logoUrl,
  name,
  shortName,
  className = 'h-12 w-12',
  imageClassName = 'h-8 w-8',
  variant = 'tint',
}) => {
  const url = logoUrl?.trim() ?? '';
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  const fallback =
    (shortName?.trim() || name.trim()).slice(0, 2).toUpperCase() || 'U';

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl ${
        variant === 'plain'
          ? 'border-transparent bg-transparent text-slate-700'
          : 'border border-teal-500/20 bg-teal-500/10 text-teal-700 dark:border-teal-400/20 dark:bg-teal-400/10 dark:text-teal-300'
      } ${className}`}
    >
      {url && !failed ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className={`object-contain ${imageClassName}`}
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          aria-hidden="true"
          className="font-['Noto_Sans_Bengali'] text-sm font-bold leading-none"
        >
          {fallback}
        </span>
      )}
    </span>
  );
};

export default UniversityLogo;
