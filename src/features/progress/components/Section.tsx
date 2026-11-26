import React from 'react';

interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  as?: 'h2' | 'h3';
}

/**
 * One heading rhythm for every section: title, optional one-line explanation,
 * optional control on the right. Sections sit on the page, not in another card,
 * so the page does not become a list of boxes.
 */
export const SectionHeading: React.FC<SectionHeadingProps> = ({
  title,
  subtitle,
  action,
  as = 'h2',
}) => {
  const Title = as;

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <Title className="text-[15px] font-bold leading-6 text-text-primary">{title}</Title>
        {subtitle ? (
          <p className="mt-0.5 text-[11px] leading-4 text-text-secondary">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
};

interface SectionCardProps {
  children: React.ReactNode;
  className?: string;
}

/** Flat surface, no border: the page background already separates the card. */
export const SectionCard: React.FC<SectionCardProps> = ({ children, className = '' }) => (
  <section className={`rounded-[20px] bg-card-bg ${className}`}>{children}</section>
);
