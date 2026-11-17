import React, { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { getIconByName } from '@/shared/utils/iconMapper';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { pickLang } from '@/shared/i18n/localize';
import ModelPageHeader from '../components/ModelPageHeader';
import ModelPaperCard from '../components/ModelPaperCard';
import PaperLauncher from '../components/PaperLauncher';
import { useModelPapers } from '../hooks/useModelPapers';
import { useModelTrackSummary } from '../hooks/useModelTrackSummary';
import {
  DEFAULT_MODEL_TRACK,
  getModelTrackConfig,
  isModelTrack,
  modelSubjectPath,
  subjectAccentClass,
  type ModelTrack,
} from '../constants/modelTracks';
import type { ModelPaperListItem } from '../services/modelPaperService';

const ModelSubjectsPage: React.FC = () => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { track: requestedTrack } = useParams<{ track: string }>();
  const [selectedPaper, setSelectedPaper] = useState<ModelPaperListItem | null>(null);

  const track: ModelTrack = isModelTrack(requestedTrack) ? requestedTrack : DEFAULT_MODEL_TRACK;
  const config = getModelTrackConfig(track);
  const TrackIcon = config.icon;

  const summaryQuery = useModelTrackSummary();
  const fullQuery = useModelPapers({ track, scope: 'full' });

  if (!isModelTrack(requestedTrack)) {
    return <Navigate to="/exams/model" replace />;
  }

  const summary = summaryQuery.data?.[track];
  const subjects = summary?.subjects ?? [];
  const fullPapers = fullQuery.data ?? [];
  const showFullSection = (summary?.fullCount ?? 0) > 0 || fullPapers.length > 0;
  const hasAnything = showFullSection || subjects.length > 0;

  return (
    <div className="min-h-screen bg-app text-text-primary">
      <ModelPageHeader
        title={t(config.labelKey)}
        subtitle={t('exam.modelSelectSubject')}
        onBack={() => navigate('/exams/model')}
      />

      <main className="mx-auto w-full max-w-4xl space-y-5 px-4 pb-10 pt-4">
        {summaryQuery.isError ? (
          <div className="rounded-2xl bg-card-bg px-4 py-6 text-center">
            <p className="text-sm font-medium text-text-primary">{t('exam.papersLoadError')}</p>
            <button
              type="button"
              onClick={() => summaryQuery.refetch()}
              className="mt-3 rounded-xl bg-surface px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {t('exam.retry')}
            </button>
          </div>
        ) : summaryQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-2.5">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`tile-skeleton-${index}`}
                className="min-h-[108px] rounded-2xl bg-card-bg p-3"
              >
                <Skeleton className="h-10 w-10 rounded-xl bg-surface-elevated" />
                <Skeleton className="mt-3 h-4 w-3/4 bg-surface-elevated" />
              </div>
            ))}
          </div>
        ) : !hasAnything ? (
          <div className="flex flex-col items-center rounded-3xl border border-border-color bg-card-bg px-6 py-10 text-center">
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-2xl ${config.accentClass}`}
            >
              <TrackIcon className="h-7 w-7" aria-hidden="true" />
            </span>
            <h2 className="mt-4 font-['Noto_Sans_Bengali'] text-base font-bold text-text-primary">
              {t('exam.noTrackPapers')}
            </h2>
            <p className="mt-1 max-w-xs text-sm text-text-secondary">
              {t('exam.noTrackPapersHint')}
            </p>
          </div>
        ) : (
          <>
            {showFullSection && (
              <section className="space-y-3">
                <h2 className="font-['Noto_Sans_Bengali'] text-base font-bold text-text-primary">
                  {t('exam.fullModelTest')}
                </h2>
                {fullQuery.isLoading ? (
                  <div className="rounded-2xl bg-card-bg p-4">
                    <Skeleton className="h-4 w-24 bg-surface-elevated" />
                    <Skeleton className="mt-3 h-5 w-3/4 bg-surface-elevated" />
                  </div>
                ) : (
                  fullPapers.map((paper) => (
                    <ModelPaperCard key={paper.id} paper={paper} onOpen={setSelectedPaper} />
                  ))
                )}
              </section>
            )}

            {subjects.length > 0 && (
              <section className="space-y-3">
                <h2 className="font-['Noto_Sans_Bengali'] text-base font-bold text-text-primary">
                  {t('exam.subjectWise')}
                </h2>
                <div className="grid grid-cols-2 gap-2.5">
                  {subjects.map((subject, index) => {
                    const Icon = getIconByName(subject.icon_url);
                    return (
                      <button
                        key={subject.id}
                        type="button"
                        onClick={() => navigate(modelSubjectPath(track, subject.id))}
                        className="flex min-h-[108px] flex-col gap-2 rounded-2xl border border-border-color bg-card-bg p-3 text-left transition-all hover:bg-surface-elevated active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                      >
                        <span
                          className={`flex h-10 w-10 items-center justify-center rounded-xl ${subjectAccentClass(index)}`}
                        >
                          <Icon size={20} strokeWidth={2} aria-hidden="true" />
                        </span>
                        <span>
                          <span className="block font-['Noto_Sans_Bengali'] text-[14.5px] font-semibold leading-snug text-text-primary">
                            {pickLang(language, subject.name_bn, subject.name_en)}
                          </span>
                          <span className="mt-0.5 block text-xs text-text-secondary">
                            {t('exam.papersCount', { count: subject.paperCount })}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <PaperLauncher paper={selectedPaper} onClose={() => setSelectedPaper(null)} />
    </div>
  );
};

export default ModelSubjectsPage;
