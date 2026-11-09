import React from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const SkeletonBlock: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded-full bg-surface-elevated ${className}`} />
);

const SkeletonCircle: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded-full bg-surface-elevated ${className}`} />
);

const SkeletonUserRow: React.FC<{
  active?: boolean;
  footer?: boolean;
}> = ({ active = false, footer = false }) => (
  <div
    className={`relative flex items-center gap-3 rounded-[1.4rem] border px-4 ${
      footer ? 'py-2.5' : 'py-3'
    } ${
      active
        ? 'border-primary/40 bg-primary/[0.04] shadow-[0_10px_28px_rgba(0,0,0,0.18)]'
        : 'border-primary/10 bg-surface/70'
    }`}
  >
    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-primary/15 bg-surface">
      <SkeletonCircle className="h-8 w-8 bg-primary/10" />
    </div>

    <div className="min-w-0 flex-1 space-y-2">
      <SkeletonBlock className={`h-3.5 ${active ? 'w-32 bg-primary/15' : 'w-28'}`} />
      <SkeletonBlock className="h-3 w-40" />
    </div>

    <div className="flex flex-col items-end gap-2">
      <SkeletonCircle className={`h-7 w-7 ${active ? 'bg-primary/15' : ''}`} />
      <SkeletonBlock className={`h-2.5 w-12 ${active ? 'bg-primary/15' : ''}`} />
    </div>
  </div>
);

type LeaderboardSkeletonProps = {
  rowsOnly?: boolean;
};

const LeaderboardSkeleton: React.FC<LeaderboardSkeletonProps> = ({ rowsOnly = false }) => {
  const { t } = useLanguage();
  if (rowsOnly) {
    return (
      <div className="space-y-2.5">
        <SkeletonUserRow active />
        <SkeletonUserRow />
        <SkeletonUserRow />
        <SkeletonUserRow />
        <SkeletonUserRow />
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen font-['Noto_Sans_Bengali'] pb-24 pt-[135px] bg-app text-text-primary">
      <section className="relative overflow-hidden border-b border-primary/10 bg-surface/60 px-4 pb-7 pt-5">
        <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-40 w-40 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative mx-auto flex max-w-md items-center justify-between">
          <button
            type="button"
            aria-label={t('leaderboard.previousLeague')}
            className="flex h-10 w-10 items-center justify-center rounded-full text-text-secondary/50"
            disabled
          >
            <ChevronLeft className="h-7 w-7" />
          </button>

          <div className="flex flex-1 flex-col items-center">
            <div className="relative mb-3 flex h-[88px] w-[88px] items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl" />

              <div
                className="h-[72px] w-[72px] animate-pulse bg-primary/35 shadow-[0_14px_40px_rgba(0,0,0,0.25)]"
                style={{
                  clipPath: 'polygon(50% 0%, 95% 35%, 78% 100%, 22% 100%, 5% 35%)',
                }}
              />

              <div
                className="absolute h-[58px] w-[58px] bg-primary/25"
                style={{
                  clipPath: 'polygon(50% 0%, 95% 35%, 78% 100%, 22% 100%, 5% 35%)',
                }}
              />
            </div>

            <SkeletonBlock className="h-6 w-32 bg-surface-elevated" />

            <div className="mt-5 h-2 w-full max-w-[340px] overflow-hidden rounded-full bg-surface-elevated">
              <div className="h-full w-1/4 animate-pulse rounded-full bg-primary/60" />
            </div>

            <div className="mt-3 flex items-center gap-1.5">
              <SkeletonBlock className="h-3 w-24" />
              <SkeletonBlock className="h-3 w-12 bg-primary/15" />
            </div>
          </div>

          <button
            type="button"
            aria-label={t('leaderboard.nextLeague')}
            className="flex h-10 w-10 items-center justify-center rounded-full text-text-secondary/70"
            disabled
          >
            <ChevronRight className="h-7 w-7" />
          </button>
        </div>
      </section>

      <div className="px-3 mt-7 space-y-2.5">
        <SkeletonUserRow active />
        <SkeletonUserRow />
        <SkeletonUserRow />
        <SkeletonUserRow />
        <SkeletonUserRow />
      </div>

      <div className="fixed bottom-[80px] md:bottom-4 left-0 right-0 z-40 px-3 pointer-events-none">
        <div className="max-w-md mx-auto rounded-2xl border border-primary/15 bg-surface-elevated/95 p-1 shadow-xl backdrop-blur-md">
          <SkeletonUserRow active footer />
        </div>
      </div>
    </div>
  );
};

export default LeaderboardSkeleton;
