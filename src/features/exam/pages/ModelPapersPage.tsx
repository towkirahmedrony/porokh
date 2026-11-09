import React, { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Skeleton } from '@/shared/components/ui/Skeleton';
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
  modelTrackPath,
  type ModelTrack,
} from '../constants/modelTracks';
import type { ModelPaperListItem } from '../services/modelPaperService';

const ModelPapersPage: React.FC = () => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { track: requestedTrack, subjectId } = useParams<{
    track: string;
    subjectId: string;
  }>();
  const [selectedPaper, setSelectedPaper] = useState<ModelPaperListItem | null>(null);

  const track: ModelTrack = isModelTrack(requestedTrack) ? requestedTrack : DEFAULT_MODEL_TRACK;
  const config = getModelTrackConfig(track);

  const summaryQuery = useModelTrackSummary();
  const papersQuery = useModelPapers({ track, scope: 'subject', subjectId: subjectId ?? null });

  if (!isModelTrack(requestedTrack) || !subjectId) {
    return <Navigate to="/exams/model" replace />;
  }

  const papers = papersQuery.data ?? [];
  const summarySubject = summaryQuery.data?.[track].subjects.find(
    (subject) => subject.id === subjectId
  );
  const joinedSubject = papers[0]?.subjects ?? null;
  const subjectName = summarySubject
    ? pickLang(language, summarySubject.name_bn, summarySubject.name_en)
    : joinedSubject
      ? pickLang(language, joinedSubject.name_bn, joinedSubject.name_en)
      : t('exam.subjectWise');

  const subtitle =
    papers.length > 0
      ? `${t(config.labelKey)} · ${t('exam.papersCount', { count: papers.length })}`
      : t(config.labelKey);

  return (
    <div className="min-h-screen bg-app text-text-primary">
      <ModelPageHeader
        title={subjectName}
        subtitle={subtitle}
        onBack={() => navigate(modelTrackPath(track))}
      />

      <main className="mx-auto w-full max-w-4xl space-y-3 px-4 pb-10 pt-4">
        {papersQuery.isLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={`paper-skeleton-${index}`} className="rounded-2xl bg-card-bg p-4">
              <Skeleton className="h-4 w-24 bg-surface-elevated" />
              <Skeleton className="mt-3 h-5 w-3/4 bg-surface-elevated" />
              <Skeleton className="mt-3 h-3 w-1/2 bg-surface-elevated" />
            </div>
          ))
        ) : papersQuery.isError ? (
          <div className="rounded-2xl bg-card-bg px-4 py-6 text-center">
            <p className="text-sm font-medium text-text-primary">{t('exam.papersLoadError')}</p>
            <button
              type="button"
              onClick={() => papersQuery.refetch()}
              className="mt-3 rounded-xl bg-surface px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {t('exam.retry')}
            </button>
          </div>
        ) : papers.length > 0 ? (
          papers.map((paper) => (
            <ModelPaperCard key={paper.id} paper={paper} onOpen={setSelectedPaper} />
          ))
        ) : (
          <div className="rounded-3xl border border-border-color bg-card-bg px-6 py-10 text-center">
            <h2 className="font-['Noto_Sans_Bengali'] text-base font-bold text-text-primary">
              {t('exam.noModelPapers')}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">{t('exam.noModelPapersHint')}</p>
          </div>
        )}
      </main>

      <PaperLauncher paper={selectedPaper} onClose={() => setSelectedPaper(null)} />
    </div>
  );
};

export default ModelPapersPage;
