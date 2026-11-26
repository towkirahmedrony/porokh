import React from 'react';
import { Link } from 'react-router-dom';
import { useProgressData } from '../hooks/useProgressData';

import { ProgressIdentity } from '../components/ProgressIdentity';
import { AccuracyHero } from '../components/AccuracyHero';
import { ActivityCalendar } from '../components/ActivityCalendar';
import { PerformanceTrend } from '../components/PerformanceTrend';
import { SkillBars } from '../components/SkillBars';
import { WeakTopics } from '../components/WeakTopics';
import { MentorNote } from '../components/MentorNote';
import { SubjectReport } from '../components/SubjectReport';
import { MistakePracticeSection } from '@/features/practice/components/MistakePracticeSection';

import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { PullToRefresh } from '@/features/groups/components/PullToRefresh';
import { useLanguage } from '@/shared/i18n/LanguageProvider';

const ProgressSkeleton: React.FC<{ label: string }> = ({ label }) => (
  <div
    role="status"
    aria-label={label}
    className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col gap-5 pb-4"
  >
    <div className="flex items-center gap-3">
      <Skeleton className="h-11 w-11 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>

    <div className="rounded-[20px] bg-card-bg p-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-[84px] w-[84px] rounded-full" />
        <div className="grid flex-1 grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="space-y-1.5">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </div>
      <Skeleton className="mt-4 h-1.5 w-full rounded-full" />
    </div>

    <div className="rounded-[20px] bg-card-bg p-4">
      <Skeleton className="h-4 w-24" />
      <div className="mt-4 grid grid-cols-7 gap-y-1">
        {Array.from({ length: 35 }, (_, index) => (
          <div key={index} className="flex h-11 items-center justify-center">
            <Skeleton className="h-9 w-9 rounded-[10px]" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

const Progress: React.FC = () => {
  const { data, isPending, isError, refetch } = useProgressData();
  const { language, t } = useLanguage();

  const textFontClass = language === 'bn' ? 'font-bengali' : 'font-sans';

  if (isPending && !data) {
    return <ProgressSkeleton label={t('progress.loadingLabel')} />;
  }

  if ((isError && !data) || !data) {
    return (
      <div
        className={`flex min-h-[60vh] flex-col items-center justify-center gap-4 ${textFontClass}`}
      >
        <EmptyState
          title={t('progress.errorTitle')}
          message={t('progress.errorMessage')}
        />
        <button
          type="button"
          onClick={() => refetch()}
          className="min-h-[44px] rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          {t('progress.retry')}
        </button>
      </div>
    );
  }

  const isNewUser =
    data.summary.exams_taken === 0 && data.summary.practice_sessions === 0;

  return (
    <PullToRefresh onRefresh={() => refetch()}>
      <div className={`mx-auto flex w-full max-w-md flex-col gap-5 pb-4 ${textFontClass}`}>
        {/* The bottom bar names the tab; the heading stays for screen readers. */}
        <h1 className="sr-only">{t('progress.title')}</h1>

        <ProgressIdentity user={data.user} />

        <AccuracyHero
          summary={data.summary}
          level={data.level}
          totalXp={data.user.total_xp}
        />

        {isNewUser ? (
          <section className="rounded-[20px] bg-card-bg p-5">
            <h2 className="text-[15px] font-bold leading-6 text-text-primary">
              {t('progress.zeroTitle')}
            </h2>
            <p className="mt-1 text-[13px] leading-6 text-text-secondary">
              {t('progress.zeroBody')}
            </p>
            <Link
              to="/exams/model"
              className="mt-4 flex min-h-[44px] items-center justify-center rounded-xl bg-primary px-4 text-[13px] font-bold text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {t('progress.zeroCta')}
            </Link>
          </section>
        ) : (
          <>
            <ActivityCalendar days={data.activity.days} />
            <PerformanceTrend points={data.performance} />
            <SkillBars subjects={data.subjects} />
            <WeakTopics topics={data.weaknesses} />
            <MentorNote mentor={data.mentor} topics={data.weaknesses} />
            <MistakePracticeSection availableCount={data.mistakes.available} />
            <SubjectReport subjects={data.subjects} />
          </>
        )}
      </div>
    </PullToRefresh>
  );
};

export default Progress;
