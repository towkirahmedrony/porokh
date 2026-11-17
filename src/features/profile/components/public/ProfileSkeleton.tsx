import React from 'react';
import { Skeleton } from '@/shared/components/ui/Skeleton';

// Constant extracted outside to prevent recreation on re-renders
const BADGE_PLACEHOLDERS = [1, 2, 3, 4];

export const ProfileSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen pb-10 animate-pulse bg-app">
      {/* Hero Section Skeleton */}
      <div className="pb-8 pt-16 px-4 rounded-b-[2rem] border-b flex flex-col items-center relative bg-app border-border-color">
        {/* Fixed TS Error: Used Tailwind class for border color instead of style prop on Skeleton */}
        <Skeleton className="w-28 h-28 rounded-full mb-4 border-4 border-border-color" />
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64 mb-6" />
        <Skeleton className="h-10 w-40 rounded-full" />
      </div>

      {/* Versus Stats Skeleton (Floating Card) */}
      <div className="mx-4 -mt-6 relative z-10">
        <div className="rounded-2xl p-5 border shadow-xl h-40 flex flex-col justify-between bg-card-bg border-border-color">
            <div className="flex justify-between px-4">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-6 w-12 rounded-full" />
                <Skeleton className="h-4 w-10" />
            </div>
            <div className="space-y-3 mt-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
            </div>
        </div>
      </div>

      {/* Activity Chart Skeleton */}
      <div className="m-4 mt-6">
        <div className="rounded-2xl p-5 border shadow-lg h-[300px] bg-card-bg border-border-color">
            <div className="flex justify-between mb-6">
                <div className="space-y-2">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-3 w-20" />
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-3 w-10 rounded-full" />
                    <Skeleton className="h-3 w-10 rounded-full" />
                </div>
            </div>
            <Skeleton className="h-[200px] w-full rounded-lg" />
        </div>
      </div>

      {/* Badges Skeleton */}
      <div className="px-6 mt-4">
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="flex gap-4 overflow-hidden">
            {BADGE_PLACEHOLDERS.map((i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                    <Skeleton className="w-16 h-16 rounded-full" />
                    <Skeleton className="h-3 w-12" />
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};
