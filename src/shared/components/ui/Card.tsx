import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  ...props
}) => (
  <div
    className={`rounded-xl shadow-sm p-4 transition-colors duration-500 bg-card-bg border border-card-border text-text-primary ${className}`}
    {...props}
  >
    {children}
  </div>
);
