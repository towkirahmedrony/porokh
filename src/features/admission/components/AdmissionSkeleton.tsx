import React from 'react';
import { Skeleton } from '@/shared/components/ui/Skeleton';

interface AdmissionSkeletonProps {
  cards?: number;
  columns?: 1 | 2 | 3;
}

export const AdmissionSkeleton: React.FC<AdmissionSkeletonProps> = ({
  cards = 6,
  columns = 3,
}) => {
  const columnClass =
    columns === 1
      ? 'grid-cols-1'
      : columns === 2
        ? 'grid-cols-1 sm:grid-cols-2'
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-6 w-24" />
      </div>

      <div className={`grid gap-3 ${columnClass}`}>
        {Array.from({ length: cards }).map((_, index) => (
          <div
            key={`admission-skeleton-${index}`}
            className="rounded-2xl border border-card-border bg-card-bg p-5"
          >
            <Skeleton className="h-12 w-12 rounded-xl" />
            <Skeleton className="mt-4 h-5 w-3/4" />
            <Skeleton className="mt-2 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-2/3" />
            <Skeleton className="mt-5 h-9 w-28 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
};

export const AdmissionExamSkeleton: React.FC = () => (
  <div
    className="mx-auto min-h-screen w-full max-w-4xl space-y-4 bg-app px-4 py-6"
    role="status"
    aria-live="polite"
  >
    <Skeleton className="h-14 w-full rounded-2xl" />
    <Skeleton className="h-72 w-full rounded-2xl" />
    <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
      {Array.from({ length: 24 }).map((_, index) => (
        <Skeleton key={`exam-nav-skeleton-${index}`} className="h-9 rounded-lg" />
      ))}
    </div>
  </div>
);
