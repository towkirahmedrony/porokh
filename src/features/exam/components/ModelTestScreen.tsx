import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import EmptyState from '@/shared/components/ui/EmptyState';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { getIconByName } from '@/shared/utils/iconMapper';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { pickLang } from '@/shared/i18n/localize';
import searchEmptyAnim from '@/assets/animations/empty-search.json';
import { useCurriculumTree } from '../hooks/useContentData';
import { useModelPapers } from '../hooks/useModelPapers';
import {
  DEFAULT_MODEL_TRACK,
  MODEL_TRACK_CONFIGS,
  isModelTrack,
  type ModelPaperScope,
  type ModelTrack,
} from '../constants/modelTracks';
import {
  modelPaperService,
  type ModelPaperListItem,
} from '../services/modelPaperService';
import type { Subject } from '../types/content';
import ModelPaperCard from './ModelPaperCard';
import PaperDetailsSheet from './PaperDetailsSheet';

interface ModelTestScreenProps {
  onViewChange: (isDetail: boolean) => void;
}

const ModelTestScreen: React.FC<ModelTestScreenProps> = ({ onViewChange }) => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const requestedTrack = searchParams.get('category');
  const track: ModelTrack = isModelTrack(requestedTrack)
    ? requestedTrack
    : DEFAULT_MODEL_TRACK;
  const requestedSubjectId = searchParams.get('subject');

  const [scope, setScope] = useState<ModelPaperScope>('subject');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedPaper, setSelectedPaper] = useState<ModelPaperListItem | null>(null);

  const { data: subjects = [], isLoading: isLoadingSubjects, isError: isSubjectsError } =
    useCurriculumTree();

  const papersQuery = useModelPapers({
    track,
    scope,
    subjectId: selectedSubject?.id ?? null,
  });

  useEffect(() => {
    if (!requestedSubjectId) return;

    const match = subjects.find((subject) => subject.id === requestedSubjectId);

    if (!match) return;

    setScope('subject');
    setSelectedSubject(match);
    onViewChange(true);
  }, [requestedSubjectId, subjects, onViewChange]);

  const startMutation = useMutation({
    mutationFn: (paper: ModelPaperListItem) => modelPaperService.startAttempt(paper.id),
    onSuccess: (attempt) => {
      navigate(`/exam/attempt/${attempt.id}`);
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error(message || t('exam.startError'));
    },
  });

  const handleTrackChange = useCallback(
    (nextTrack: ModelTrack) => {
      if (nextTrack === track) return;

      const next = new URLSearchParams(searchParams);
      next.set('category', nextTrack);
      next.delete('subject');
      setSearchParams(next, { replace: true });
      setSelectedSubject(null);
      setSelectedPaper(null);
      onViewChange(false);
    },
    [track, searchParams, setSearchParams, onViewChange]
  );

  const handleScopeChange = useCallback(
    (nextScope: ModelPaperScope) => {
      if (nextScope === scope) return;

      const next = new URLSearchParams(searchParams);
      next.delete('subject');
      setSearchParams(next, { replace: true });
      setScope(nextScope);
      setSelectedSubject(null);
      setSelectedPaper(null);
      onViewChange(false);
    },
    [scope, onViewChange, searchParams, setSearchParams]
  );

  const handleSubjectOpen = useCallback(
    (subject: Subject) => {
      const next = new URLSearchParams(searchParams);
      next.set('subject', subject.id);
      setSearchParams(next, { replace: true });
      setSelectedSubject(subject);
      onViewChange(true);
    },
    [onViewChange, searchParams, setSearchParams]
  );

  const handleSubjectBack = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('subject');
    setSearchParams(next, { replace: true });
    setSelectedSubject(null);
    setSelectedPaper(null);
    onViewChange(false);
  }, [onViewChange, searchParams, setSearchParams]);

  const handleStart = useCallback(
    (paper: ModelPaperListItem) => {
      startMutation.mutate(paper);
    },
    [startMutation]
  );

  const subjectName = useMemo(() => {
    if (!selectedSubject) return '';
    return pickLang(language, selectedSubject.name_bn, selectedSubject.name_en);
  }, [selectedSubject, language]);

  const papers = papersQuery.data ?? [];
  const showPaperList = scope === 'full' || Boolean(selectedSubject);

  return (
    <div className="space-y-4 pb-20 animate-fade-in">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {MODEL_TRACK_CONFIGS.map((config) => {
          const Icon = config.icon;
          const isActive = config.value === track;

          return (
            <button
              key={config.value}
              type="button"
              onClick={() => handleTrackChange(config.value)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-surface text-text-secondary hover:bg-surface-elevated'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {t(config.labelKey)}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1">
        {(
          [
            { value: 'full' as const, labelKey: 'exam.fullModelTest' as const },
            { value: 'subject' as const, labelKey: 'exam.subjectWise' as const },
          ]
        ).map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => handleScopeChange(item.value)}
            className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
              scope === item.value
                ? 'bg-primary text-primary-foreground'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </div>

      {showPaperList ? (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              {selectedSubject && (
                <button
                  type="button"
                  onClick={handleSubjectBack}
                  aria-label={t('exam.backToPapers')}
                  className="rounded-full bg-surface p-2 text-text-secondary transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              <h2 className="truncate font-['Noto_Sans_Bengali'] text-lg font-bold text-text-primary">
                {scope === 'full' ? t('exam.fullModelTest') : subjectName}
              </h2>
            </div>
            {!papersQuery.isLoading && papers.length > 0 && (
              <span className="shrink-0 text-xs font-medium text-text-secondary">
                {t('exam.papersCount', { count: papers.length })}
              </span>
            )}
          </div>

          {papersQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={`paper-skeleton-${index}`} className="rounded-2xl bg-card-bg p-4">
                  <Skeleton className="h-4 w-24 bg-surface-elevated" />
                  <Skeleton className="mt-3 h-5 w-3/4 bg-surface-elevated" />
                  <Skeleton className="mt-3 h-3 w-1/2 bg-surface-elevated" />
                </div>
              ))}
            </div>
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
            <div className="space-y-3">
              {papers.map((paper) => (
                <ModelPaperCard key={paper.id} paper={paper} onOpen={setSelectedPaper} />
              ))}
            </div>
          ) : (
            <EmptyState
              message={
                scope === 'full'
                  ? t('exam.noFullModelPapers')
                  : t('exam.noModelPapers')
              }
              subMessage={
                scope === 'full'
                  ? t('exam.noFullModelPapersHint')
                  : t('exam.noModelPapersHint')
              }
              animationData={searchEmptyAnim}
            />
          )}
        </section>
      ) : (
        <section>
          <div className="mb-3">
            <h2 className="font-['Noto_Sans_Bengali'] text-lg font-bold text-text-primary">
              {t('exam.modelSelectSubject')}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">{t('exam.modelSelectSubjectHint')}</p>
          </div>

          {isSubjectsError ? (
            <div className="rounded-2xl bg-card-bg px-4 py-6 text-center">
              <p className="text-sm font-medium text-text-primary">{t('exam.subjectsLoadError')}</p>
            </div>
          ) : isLoadingSubjects ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={`subject-skeleton-${index}`}
                  className="flex items-center gap-4 rounded-2xl bg-card-bg p-4"
                >
                  <Skeleton className="h-10 w-10 rounded-xl bg-surface-elevated" />
                  <Skeleton className="h-4 w-1/2 bg-surface-elevated" />
                </div>
              ))}
            </div>
          ) : subjects.length > 0 ? (
            <div className="space-y-3">
              {subjects.map((subject) => {
                const Icon = getIconByName(subject.icon_url);
                return (
                  <button
                    key={subject.id}
                    type="button"
                    onClick={() => handleSubjectOpen(subject)}
                    className="group flex w-full items-center justify-between rounded-2xl bg-card-bg p-4 text-left transition-all hover:bg-surface-elevated active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    <span className="flex min-w-0 items-center gap-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-primary">
                        <Icon size={20} strokeWidth={2} />
                      </span>
                      <span className="truncate font-['Noto_Sans_Bengali'] text-[15px] font-medium text-text-primary">
                        {pickLang(language, subject.name_bn, subject.name_en)}
                      </span>
                    </span>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-text-secondary transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState
              message={t('exam.modelNoSubjects')}
              subMessage={t('exam.modelNoSubjectsHint')}
              animationData={searchEmptyAnim}
            />
          )}
        </section>
      )}

      {startMutation.isPending && selectedPaper && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-app/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-2xl bg-card-bg px-4 py-3 text-sm font-semibold text-text-primary">
            <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
            {t('exam.starting')}
          </div>
        </div>
      )}

      {selectedPaper && (
        <PaperDetailsSheet
          paper={selectedPaper}
          isStarting={startMutation.isPending}
          onClose={() => setSelectedPaper(null)}
          onStart={handleStart}
        />
      )}
    </div>
  );
};

export default ModelTestScreen;
