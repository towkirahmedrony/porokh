import React, { memo } from 'react';
import { Skeleton } from '@/shared/components/ui/Skeleton';

interface Props {
  label: string;
  rows?: number;
}

export const HistorySkeleton: React.FC<Props> = memo(({ label, rows = 3 }) => (
  <div role="status" aria-label={label} className="space-y-3">
    {Array.from({ length: rows }, (_, index) => (
      <div key={index} className="rounded-[20px] bg-card-bg p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
        <Skeleton className="mt-3 h-3 w-2/5" />
        <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
      </div>
    ))}
  </div>
));

HistorySkeleton.displayName = 'HistorySkeleton';
