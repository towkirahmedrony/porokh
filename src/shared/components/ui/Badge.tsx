import React, { memo } from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
}

export const Badge = memo(
  React.forwardRef<HTMLSpanElement, BadgeProps>(
    ({ children, className = '', ...props }, ref) => {
      return (
        <span
          ref={ref}
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold transition-colors bg-badge-bg text-badge-text ${className}`}
          {...props}
        >
          {children}
        </span>
      );
    }
  )
);

Badge.displayName = 'Badge';
