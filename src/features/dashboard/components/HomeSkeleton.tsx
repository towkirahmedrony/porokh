import React from 'react';

const HomeSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-app pb-24">
      <div className="mx-auto w-full max-w-6xl px-3 pt-3 space-y-3">

        {/* Greeting Section Skeleton */}
        <section className="rounded-[20px] border border-card-border bg-card-bg px-4 py-3 h-[68px] flex justify-between items-center animate-pulse">
          <div className="space-y-2">
            <div className="h-5 w-32 rounded-lg bg-surface-elevated" />
            <div className="h-3 w-24 rounded-lg bg-surface-elevated" />
          </div>
          <div className="h-7 w-20 rounded-full bg-surface-elevated" />
        </section>

        {/* Feature Grid Skeleton */}
        <section className="grid grid-cols-3 gap-2.5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-[112px] rounded-[18px] bg-surface-elevated animate-pulse" />
          ))}
        </section>

      </div>
    </div>
  );
};

export default HomeSkeleton;
