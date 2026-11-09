import React from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { useAuth } from '@/features/auth/hooks/useAuth';
import ModelPageHeader from '../components/ModelPageHeader';
import { useModelTrackSummary } from '../hooks/useModelTrackSummary';
import {
  MODEL_TRACK_CONFIGS,
  isModelTrack,
  modelTrackPath,
} from '../constants/modelTracks';

const ModelCategoryPage: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const summaryQuery = useModelTrackSummary();

  const goalTrack = isModelTrack(user?.study_goal) ? user.study_goal : null;
  const orderedTracks = goalTrack
    ? [...MODEL_TRACK_CONFIGS].sort(
        (a, b) => Number(b.value === goalTrack) - Number(a.value === goalTrack)
      )
    : MODEL_TRACK_CONFIGS;

  const legacyTrack = searchParams.get('category');
  if (legacyTrack === 'varsity') {
    return <Navigate to="/admission" replace />;
  }
  if (isModelTrack(legacyTrack)) {
    return <Navigate to={modelTrackPath(legacyTrack)} replace />;
  }

  return (
    <div className="min-h-screen bg-app text-text-primary">
      <ModelPageHeader
        title={t('exam.modelTest')}
        onBack={() => navigate('/dashboard/home')}
      />

      <main className="mx-auto w-full max-w-4xl space-y-3 px-4 pb-10 pt-5">
        <h2 className="font-['Noto_Sans_Bengali'] text-xl font-bold text-text-primary">
          {t('exam.modelChooseTrack')}
        </h2>

        {orderedTracks.map((config) => {
          const Icon = config.icon;
          const count = summaryQuery.data?.[config.value].paperCount ?? 0;
          const isGoalTrack = config.value === goalTrack;

          return (
            <button
              key={config.value}
              type="button"
              onClick={() => navigate(modelTrackPath(config.value))}
              className="flex w-full items-center gap-4 rounded-3xl border border-border-color bg-card-bg p-4 text-left transition-all hover:bg-surface-elevated active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <span
                className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${config.accentClass}`}
              >
                <Icon className="h-8 w-8" aria-hidden="true" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-['Noto_Sans_Bengali'] text-lg font-bold text-text-primary">
                    {t(config.labelKey)}
                  </span>
                  {isGoalTrack && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                      {t('exam.yourGoal')}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-sm text-text-secondary">
                  {t(config.descriptionKey)}
                </span>
                {summaryQuery.isLoading ? (
                  <Skeleton className="mt-1.5 h-3 w-16 bg-surface-elevated" />
                ) : summaryQuery.data ? (
                  <span className="mt-1 block text-xs font-semibold text-primary">
                    {count > 0
                      ? t('exam.papersCount', { count })
                      : t('exam.trackComingSoon')}
                  </span>
                ) : null}
              </span>

              <ChevronRight
                className="h-5 w-5 shrink-0 text-text-secondary"
                aria-hidden="true"
              />
            </button>
          );
        })}
      </main>
    </div>
  );
};

export default ModelCategoryPage;
