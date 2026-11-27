import type { ReactNode } from 'react';

/**
 * A titled group of hub rows.
 *
 * The heading is content, not chrome: it names what the rows below have in
 * common. `meta` carries the one number the heading cannot say, such as how
 * many subjects hold questions.
 */
export function HubSection({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h2 className="text-[13px] font-extrabold text-text-primary">{title}</h2>
        {meta && (
          <span className="text-[11px] font-medium text-text-secondary">{meta}</span>
        )}
      </div>
      {children}
    </section>
  );
}
