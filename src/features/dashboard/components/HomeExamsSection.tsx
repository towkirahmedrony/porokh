import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  ChevronDown,
  Clock3,
  ListChecks,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { LOCALE_BY_LANGUAGE, localizeDigits } from '@/shared/i18n/messages';
import { pickLang } from '@/shared/i18n/localize';
import { useBackInterceptor } from '@/app/navigation/useBackInterceptor';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useStartModelPaper } from '@/features/exam/hooks/useStartModelPaper';
import ModelPaperCard from '@/features/exam/components/ModelPaperCard';
import PaperLauncher from '@/features/exam/components/PaperLauncher';
import {
  MODEL_CATEGORY_CONFIGS,
  type ModelCategory,
} from '@/features/exam/constants/modelTracks';
import type { ModelPaperListItem } from '@/features/exam/services/modelPaperService';
import { useHomeExams } from '../hooks/useHomeExams';
import {
  homeExamService,
  isHomeExamTrack,
  type HomeExamTrack,
} from '../services/homeExamService';
import { formatCountdown, splitHomeExams } from '../utils/homeExamTiming';

/**
 * One interval for every countdown on the screen. It only runs while a timed
 * paper is on screen and is torn down on unmount or when the list empties.
 */
const useSharedNow = (enabled: boolean): number => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;

    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [enabled]);

  return now;
};

const getTrackConfig = (track: HomeExamTrack) =>
  MODEL_CATEGORY_CONFIGS.find((config) => config.value === track) ??
  MODEL_CATEGORY_CONFIGS[0];

const formatStartTime = (iso: string, language: 'bn' | 'en'): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat(LOCALE_BY_LANGUAGE[language], {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const ExamMeta: React.FC<{ paper: ModelPaperListItem }> = ({ paper }) => {
  const { t } = useLanguage();
  const hasQuestions = Boolean(paper.question_count);
  const hasDuration = Boolean(paper.duration_min);

  if (!hasQuestions && !hasDuration) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
      {hasQuestions && (
        <span className="inline-flex items-center gap-1.5">
          <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
          {t('exam.questionsCount', { count: paper.question_count ?? 0 })}
        </span>
      )}
      {hasDuration && (
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
          {t('exam.minutesValue', { count: paper.duration_min ?? 0 })}
        </span>
      )}
    </div>
  );
};

const TrackChip: React.FC<{ label: string }> = ({ label }) => (
  <span className="rounded-full bg-badge-bg px-2 py-0.5 text-[11px] font-semibold text-badge-text">
    {label}
  </span>
);

const LiveExamCard: React.FC<{
  paper: ModelPaperListItem;
  trackLabel: string;
  now: number;
  isStarting: boolean;
  onStart: (paper: ModelPaperListItem) => void;
}> = ({ paper, trackLabel, now, isStarting, onStart }) => {
  const { t, language } = useLanguage();
  const title = pickLang(language, paper.title, paper.title_en) || paper.title;

  return (
    <article className="rounded-[18px] bg-card-bg p-3.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-danger">
              <span
                className="h-1.5 w-1.5 rounded-full bg-danger motion-safe:animate-pulse"
                aria-hidden="true"
              />
              {t('home.exams.liveBadge')}
            </span>
            <TrackChip label={trackLabel} />
          </div>

          <h3 className="mt-2 line-clamp-2 font-['Noto_Sans_Bengali'] text-[15px] font-bold leading-snug text-text-primary">
            {title}
          </h3>

          <ExamMeta paper={paper} />

          <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            {t('home.exams.endsIn', {
              time: localizeDigits(formatCountdown(paper.end_time, now), language),
            })}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onStart(paper)}
          disabled={isStarting}
          className="min-h-11 shrink-0 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          {t('home.exams.start')}
        </button>
      </div>
    </article>
  );
};

const UpcomingExamCard: React.FC<{
  paper: ModelPaperListItem;
  trackLabel: string;
  now: number;
  onDetails: (paper: ModelPaperListItem) => void;
}> = ({ paper, trackLabel, now, onDetails }) => {
  const { t, language } = useLanguage();
  const title = pickLang(language, paper.title, paper.title_en) || paper.title;
  const startTime = paper.start_time ? formatStartTime(paper.start_time, language) : '';

  return (
    <article className="rounded-[18px] bg-card-bg p-3.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <TrackChip label={trackLabel} />
            {startTime && (
              <span className="text-[11px] font-semibold text-text-secondary">
                {t('home.exams.startsAt', { time: startTime })}
              </span>
            )}
          </div>

          <h3 className="mt-2 line-clamp-2 font-['Noto_Sans_Bengali'] text-[15px] font-bold leading-snug text-text-primary">
            {title}
          </h3>

          <ExamMeta paper={paper} />

          <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            {t('home.exams.startsIn', {
              time: localizeDigits(formatCountdown(paper.start_time, now), language),
            })}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onDetails(paper)}
          className="min-h-11 shrink-0 rounded-full bg-badge-bg px-4 text-sm font-bold text-badge-text transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          {t('home.exams.details')}
        </button>
      </div>
    </article>
  );
};

const TargetSheet: React.FC<{
  current: HomeExamTrack;
  pending: boolean;
  onClose: () => void;
  onSelect: (track: HomeExamTrack) => void;
}> = ({ current, pending, onClose, onSelect }) => {
  const { t } = useLanguage();
  useBackInterceptor(onClose);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label={t('exam.close')}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('home.exams.changeTarget')}
        className="relative w-full max-w-lg rounded-t-3xl bg-card-bg p-4 pb-8 sm:rounded-3xl sm:pb-5"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border-color sm:hidden" />

        <p className="px-1 font-['Noto_Sans_Bengali'] text-base font-bold text-text-primary">
          {t('home.exams.chooseTargetTitle')}
        </p>

        <div className="mt-3 space-y-1">
          {MODEL_CATEGORY_CONFIGS.map((config) => {
            const Icon = config.icon;
            const selected = config.value === current;

            return (
              <button
                key={config.value}
                type="button"
                onClick={() => onSelect(config.value)}
                disabled={pending}
                className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-surface-elevated active:bg-surface-elevated disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${config.accentClass}`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 font-['Noto_Sans_Bengali'] text-[15px] font-semibold text-text-primary">
                  {t(config.labelKey)}
                </span>
                {selected && (
                  <Check className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const NoGoalChoices: React.FC<{
  pending: boolean;
  onSelect: (track: HomeExamTrack) => void;
}> = ({ pending, onSelect }) => {
  const { t } = useLanguage();

  return (
    <section className="mt-5 rounded-[18px] bg-card-bg p-4">
      <h2 className="font-['Noto_Sans_Bengali'] text-base font-bold text-text-primary">
        {t('home.exams.chooseTargetTitle')}
      </h2>
      <p className="mt-1 font-['Noto_Sans_Bengali'] text-sm leading-6 text-text-secondary">
        {t('home.exams.chooseTargetBody')}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {MODEL_CATEGORY_CONFIGS.map((config) => (
          <button
            key={config.value}
            type="button"
            onClick={() => onSelect(config.value)}
            disabled={pending}
            className="min-h-12 rounded-2xl bg-secondary font-['Noto_Sans_Bengali'] text-sm font-semibold text-text-primary transition-transform active:scale-[0.98] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {t(config.labelKey)}
          </button>
        ))}
      </div>
    </section>
  );
};

/**
 * Owns the only countdown interval, so the model-test list below does not
 * re-render once per second. One timer feeds every live and upcoming card.
 */
const TimedExamList: React.FC<{
  papers: ModelPaperListItem[];
  trackLabel: string;
  isStarting: boolean;
  onStart: (paper: ModelPaperListItem) => void;
  onDetails: (paper: ModelPaperListItem) => void;
}> = ({ papers, trackLabel, isStarting, onStart, onDetails }) => {
  const { t } = useLanguage();
  const now = useSharedNow(papers.length > 0);
  const { live, upcoming } = useMemo(
    () => splitHomeExams(papers, now),
    [papers, now]
  );

  if (live.length === 0 && upcoming.length === 0) return null;

  return (
    <div className="space-y-2.5">
      <h2 className="font-['Noto_Sans_Bengali'] text-base font-bold text-text-primary">
        {t('home.exams.liveUpcomingTitle')}
      </h2>

      {live.map((paper) => (
        <LiveExamCard
          key={paper.id}
          paper={paper}
          trackLabel={trackLabel}
          now={now}
          isStarting={isStarting}
          onStart={onStart}
        />
      ))}

      {upcoming.map((paper) => (
        <UpcomingExamCard
          key={paper.id}
          paper={paper}
          trackLabel={trackLabel}
          now={now}
          onDetails={onDetails}
        />
      ))}
    </div>
  );
};

const SectionsSkeleton: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="space-y-4" role="status" aria-label={t('home.exams.loading')}>
      <div className="space-y-2.5">
        <Skeleton className="h-5 w-44 rounded-md bg-surface-elevated" />
        <Skeleton className="h-[112px] rounded-[18px] bg-surface-elevated" />
      </div>
      <div className="space-y-2.5">
        <Skeleton className="h-5 w-52 rounded-md bg-surface-elevated" />
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton
            key={`home-exam-skeleton-${index}`}
            className="h-[88px] rounded-[18px] bg-surface-elevated"
          />
        ))}
      </div>
    </div>
  );
};

const HomeExamsSection: React.FC = () => {
  const { t } = useLanguage();
  const { user, updateUserProfile } = useAuth();
  const queryClient = useQueryClient();
  const startMutation = useStartModelPaper();

  const goal = user?.study_goal ?? null;
  const track: HomeExamTrack | null = isHomeExamTrack(goal) ? goal : null;
  const trackConfig = track ? getTrackConfig(track) : null;

  const { timedPapers, modelTests, isLoading, modelTestsError, refetch } =
    useHomeExams(track);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<ModelPaperListItem | null>(null);

  const saveTarget = useMutation({
    mutationFn: (nextTrack: HomeExamTrack) => {
      if (!user?.id) throw new Error('Not signed in');
      return homeExamService.saveStudyGoal(user.id, nextTrack);
    },
    onSuccess: (_data, nextTrack) => {
      if (user?.id) updateUserProfile(user.id, { study_goal: nextTrack });
      setPickerOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['home-exams'] });
    },
    onError: () => {
      toast.error(t('home.exams.saveError'));
    },
  });

  const selectTrack = useCallback(
    (nextTrack: ModelCategory) => {
      if (saveTarget.isPending) return;
      if (nextTrack === track) {
        setPickerOpen(false);
        return;
      }
      saveTarget.mutate(nextTrack);
    },
    [saveTarget, track]
  );

  const openDetails = useCallback((paper: ModelPaperListItem) => {
    setSelectedPaper(paper);
  }, []);

  const startLive = useCallback(
    (paper: ModelPaperListItem) => {
      startMutation.mutate(paper);
    },
    [startMutation]
  );

  if (!track || !trackConfig) {
    return <NoGoalChoices pending={saveTarget.isPending} onSelect={selectTrack} />;
  }

  const trackLabel = t(trackConfig.labelKey);
  const seeAllPath = `/exams/model/${track}`;
  const showFullError = !isLoading && modelTestsError && modelTests.length === 0;

  return (
    <section className="mt-5 space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          aria-haspopup="dialog"
          className="inline-flex min-h-11 items-center gap-1 rounded-full bg-badge-bg px-3.5 font-['Noto_Sans_Bengali'] text-[13px] font-bold text-badge-text transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          {t('home.exams.targetChip', { track: trackLabel })}
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {isLoading ? (
        <SectionsSkeleton />
      ) : (
        <>
          <TimedExamList
            papers={timedPapers}
            trackLabel={trackLabel}
            isStarting={startMutation.isPending}
            onStart={startLive}
            onDetails={openDetails}
          />

          <div className="space-y-2.5">
            <div className="flex min-h-11 items-center justify-between gap-2">
              <h2 className="font-['Noto_Sans_Bengali'] text-base font-bold text-text-primary">
                {t('home.exams.forYouTitle')}
              </h2>
              <Link
                to={seeAllPath}
                className="inline-flex min-h-11 items-center px-1 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                {t('home.exams.seeAll')}
              </Link>
            </div>

            {showFullError ? (
              <div role="alert" className="rounded-[18px] bg-card-bg px-4 py-5 text-center">
                <p className="font-['Noto_Sans_Bengali'] text-sm font-semibold text-text-primary">
                  {t('home.exams.loadFailed')}
                </p>
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-secondary px-4 text-sm font-semibold text-text-primary transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  {t('exam.retry')}
                </button>
              </div>
            ) : modelTests.length > 0 ? (
              modelTests.map((paper) => (
                <ModelPaperCard key={paper.id} paper={paper} onOpen={openDetails} />
              ))
            ) : (
              <div className="rounded-[18px] bg-card-bg px-4 py-5">
                <p className="font-['Noto_Sans_Bengali'] text-sm font-bold text-text-primary">
                  {t('home.exams.emptyTitle')}
                </p>
                <p className="mt-1 font-['Noto_Sans_Bengali'] text-xs leading-5 text-text-secondary">
                  {t('home.exams.emptyBody')}
                </p>
                <Link
                  to="/exams/model"
                  className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  {t('home.exams.otherTracks')}
                </Link>
              </div>
            )}
          </div>
        </>
      )}

      {pickerOpen && (
        <TargetSheet
          current={track}
          pending={saveTarget.isPending}
          onClose={() => setPickerOpen(false)}
          onSelect={selectTrack}
        />
      )}

      <PaperLauncher
        paper={selectedPaper}
        onClose={() => setSelectedPaper(null)}
      />
    </section>
  );
};

export default memo(HomeExamsSection);
