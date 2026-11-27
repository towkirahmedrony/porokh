import React from 'react';

import type { HeaderStatusChip } from '@/shared/lib/academic';

interface AcademicStatusChipsProps {
  chips: HeaderStatusChip[];
  /** True only while the stage is still unknown: never render a guess. */
  loading?: boolean;
}

/**
 * The status row under a student's name. It wraps instead of truncating, so a
 * 360px phone shows two short chips on two rows rather than half a label.
 *
 * Spans, not a list: the Profile header puts these inside one edit-profile
 * button, which only accepts phrasing content.
 */
export const AcademicStatusChips: React.FC<AcademicStatusChipsProps> = ({
  chips,
  loading = false,
}) => {
  if (loading) {
    return (
      <span className="flex flex-wrap gap-2" aria-hidden="true">
        <span className="h-6 w-28 animate-pulse rounded-full bg-secondary" />
      </span>
    );
  }

  if (chips.length === 0) return null;

  return (
    <span className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span
          key={`${chip.kind}-${chip.text}`}
          className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-xs font-semibold leading-4 ${
            chip.kind === 'goal'
              ? 'bg-badge-bg text-badge-text'
              : 'bg-secondary text-text-primary'
          }`}
        >
          {chip.text}
        </span>
      ))}
    </span>
  );
};
