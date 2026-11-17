import React from 'react';
import { useProgressData } from '../hooks/useProgressData';

import { ProgressHeader } from '../components/ProgressHeader';
import { MetricsGrid } from '../components/MetricsGrid';
import { ChartsSection } from '../components/ChartsSection';
import { AnalysisSection } from '../components/AnalysisSection';
import { SubjectReportSection } from '../components/SubjectReportSection';
import { ActivityHeatmap } from '../components/ActivityHeatmap';
import { MistakePracticeSection } from '@/features/practice/components/MistakePracticeSection';

import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { useLanguage } from '@/shared/i18n/LanguageProvider';

const ProgressSkeleton: React.FC<{ label: string }> = ({ label }) => {
  return (
    <div
      role="status"
      aria-label={label}
      className="min-h-screen px-4 pt-4 pb-20 flex flex-col gap-4 bg-app text-text-primary"
    >
      <div className="rounded-2xl p-4 flex items-center gap-4 shadow-sm animate-pulse bg-card-bg border border-card-border">
        <div className="w-16 h-16 rounded-full shrink-0 bg-secondary" />
        <div className="flex-col space-y-2 flex-1">
          <div className="h-5 w-40 rounded-md bg-secondary" />
          <div className="h-6 w-28 rounded-full bg-secondary" />
        </div>
      </div>

      {[1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="rounded-2xl p-5 flex items-center justify-between shadow-sm animate-pulse bg-card-bg border border-card-border"
        >
          <div className="flex-col space-y-3 flex-1">
            <div className="h-4 w-20 rounded-md bg-secondary" />
            <div className="h-6 w-24 rounded-md bg-secondary" />
            <div className="h-3 w-32 rounded-md mt-1 bg-surface-elevated" />
          </div>
          <div className="w-12 h-12 rounded-xl shrink-0 bg-secondary" />
        </div>
      ))}

      <div className="h-[300px] w-full rounded-2xl shadow-sm animate-pulse mt-2 flex items-center justify-center bg-card-bg border border-card-border">
        <div className="w-[90%] h-[90%] rounded-xl bg-surface-elevated" />
      </div>
    </div>
  );
};

const Progress: React.FC = () => {
  const { data, isPending, isError, refetch } = useProgressData();
  const { language, t } = useLanguage();

  const textFontClass =
    language === 'bn' ? "font-['Noto_Sans_Bengali']" : 'font-sans';

  if (isPending && !data) {
    return <ProgressSkeleton label={t('progress.loadingLabel')} />;
  }

  if (isError && !data) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center gap-4 p-4 bg-app text-text-primary ${textFontClass}`}
      >
        <EmptyState
          title={t('progress.errorTitle')}
          message={t('progress.errorMessage')}
        />
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-app"
        >
          {t('progress.retry')}
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center p-4 bg-app text-text-primary ${textFontClass}`}
      >
        <EmptyState
          title={t('progress.emptyTitle')}
          message={t('progress.emptyMessage')}
        />
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen pb-24 flex flex-col gap-6 animate-in fade-in duration-500 px-4 pt-4 bg-app text-text-primary ${textFontClass}`}
    >
      <ProgressHeader user={data.user} />
      <MetricsGrid metrics={data.metrics} />
      <MistakePracticeSection />
      <ActivityHeatmap data={data.activityHeatmap} />
      <ChartsSection
        performanceChart={data.performanceChart}
        skillMapping={data.skillMapping}
      />
      <AnalysisSection
        weaknesses={data.weaknesses}
        focusTopic={data.focusTopic}
        aiAnalysis={data.aiAnalysis} // 🔥 AI Data Passed Here
      />
      <SubjectReportSection subjectReport={data.subjectReport} />
    </div>
  );
};

export default Progress;
