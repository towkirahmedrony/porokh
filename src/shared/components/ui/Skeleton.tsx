import React, { memo } from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = memo(({ className = '' }) => {
  return (
    <div className={`animate-pulse rounded-md bg-secondary ${className}`} />
  );
});

Skeleton.displayName = 'Skeleton';

export const HomeSkeleton: React.FC = memo(() => {
  return (
    <div className="space-y-6 p-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      
      <div className="grid grid-cols-2 gap-4 mt-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="aspect-square rounded-2xl w-full" />
        ))}
      </div>
    </div>
  );
});

HomeSkeleton.displayName = 'HomeSkeleton';
