import { useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Building2,
  ChevronLeft,
  FileCheck2,
  GraduationCap,
  RefreshCw,
  Search,
  Stethoscope,
  Wrench,
} from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits, type AppMessageKey } from '@/shared/i18n/messages';
import { PullToRefresh } from '@/features/groups/components/PullToRefresh';
import { useStage } from '@/features/stage/hooks/useStage';
import { resolveBankMode } from '../utils/bankMode';
import { useQuestionBankHub } from '../hooks/useQuestionBankHub';
import { useUniversityLogoMap } from '../hooks/useUniversityLogoMap';
import {
  findSection,
  hubAdmissionSubjectHref,
  hubAllAdmissionHref,
  hubAllCollegesHref,
  hubInstitutionHref,
  hubSearchHref,
  hubSubjectHref,
  hubTrackHref,
  isThinTrack,
} from '../utils/questionBankHub';
import {
  questionBankSessionKey,
  readQuestionBankSession,
  writeQuestionBankSession,
} from '../utils/questionBankSession';
import type {
  QuestionBankHubMode,
  QuestionBankHubPayload,
  QuestionBankHubRow,
} from '../types/questionBankHub';
import type { QuestionBankTrack } from '../types/questionBank';
import { HubRow, HubRowList } from '../components/hub/HubRow';
import { HubGrid, HubGridTile } from '../components/hub/HubGridTile';
import { HubSkeleton } from '../components/hub/HubSkeleton';
import { HubUniversityCard } from '../components/hub/HubUniversityCard';

/**
 * The entrance to the question bank.
 *
 * The list is unchanged and still lives at /question-bank/list; this screen is
 * what a student sees first, ordered by their own stage and goal. Every number
 * on it comes from the server's hub payload, and every tile opens the list with
 * the filters that produced that number.
 *
 * The floating control at the top chooses how the same bank is grouped: by exam
 * (a track or a board), by institution, or by subject. The choice lives in the
 * URL so a tab survives a drill-down and the back button, and no grouping needs
 * a second request — the hub payload already carries all three.
 *
 * Stage handling mirrors the list on purpose: a stage that has not arrived is a
 * skeleton, never a guess. The one difference is a failed stage refresh with a
 * previously cached answer: the last server answer is used rather than hiding
 * the bank behind a spinner forever.
 */

type HubTab = 'model' | 'institution' | 'subject';

const HUB_TABS: { id: HubTab; labelKey: AppMessageKey; Icon: typeof BookOpen }[] = [
  { id: 'model', labelKey: 'exam.modelTest', Icon: FileCheck2 },
  { id: 'institution', labelKey: 'profile.fieldInstitution', Icon: Building2 },
  { id: 'subject', labelKey: 'admission.hub.filterSubject', Icon: BookOpen },
];

const readHubTab = (search: string): HubTab => {
  const value = new URLSearchParams(search).get('by');
  return value === 'model' || value === 'subject' ? value : 'institution';
};

const getScrollParent = (element: HTMLElement | null): HTMLElement | null => {
  let node = element?.parentElement ?? null;
  while (node) {
    const overflowY = window.getComputedStyle(node).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
    node = node.parentElement;
  }
  return null;
};

const trackLabelKey = (track: QuestionBankTrack) =>
  track === 'medical'
    ? 'questionBank.hub.sectionMedical'
    : track === 'engineering'
      ? 'questionBank.hub.sectionEngineering'
      : 'questionBank.hub.sectionUniversities';

const trackIcon = (track: QuestionBankTrack) => {
  const Icon = track === 'medical' ? Stethoscope : track === 'engineering' ? Wrench : GraduationCap;
  return <Icon className="h-5 w-5" aria-hidden="true" />;
};

const byCountThenName = (a: QuestionBankHubRow, b: QuestionBankHubRow): number =>
  b.count - a.count || a.labelBn.localeCompare(b.labelBn, 'bn');

export default function QuestionBankHub() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { stage, goal, status: stageStatus, refresh } = useStage();

  // A cached stage plus a failed refresh is still the server's last answer.
  const bankMode = resolveBankMode({
    stage,
    goal,
    status: stage !== null ? 'ready' : stageStatus,
  });

  const urlMode: QuestionBankHubMode =
    new URLSearchParams(location.search).get('mode') === 'admission'
      ? 'admission'
      : 'hsc';

  const requestedMode: QuestionBankHubMode | null =
    bankMode.mode === 'neutral' ? null : bankMode.mode === 'admission' ? 'admission' : urlMode;

  const { payload, isPending, isError, error, refetch, isFetching } =
    useQuestionBankHub(requestedMode);

  const tab = readHubTab(location.search);
  const pageRef = useRef<HTMLDivElement>(null);
  const restoredKeyRef = useRef('');

  const activeMode = payload.mode ?? requestedMode;
  const sessionKey = questionBankSessionKey(location.pathname, location.search);

  // The hub is a page students return to after every drill-down, so its scroll
  // position is restored the way the list restores its own. It waits for the
  // payload: restoring before the tiles exist would scroll a short page to the
  // top and lose the position anyway.
  useEffect(() => {
    if (isPending || isError) return;
    if (restoredKeyRef.current === sessionKey) return;

    const stored = readQuestionBankSession(sessionKey);
    const frame = window.requestAnimationFrame(() => {
      restoredKeyRef.current = sessionKey;
      if (!stored) return;
      getScrollParent(pageRef.current)?.scrollTo({ top: stored.scrollY });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isPending, isError, sessionKey]);

  useEffect(() => {
    const container = getScrollParent(pageRef.current);
    if (!container) return;

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        writeQuestionBankSession(sessionKey, { scrollY: container.scrollTop });
      });
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [sessionKey]);

  useEffect(() => {
    if (!error) return;
    console.error('[question-bank] hub request failed', { mode: requestedMode, error });
  }, [error, requestedMode]);

  const switchMode = (next: QuestionBankHubMode) => {
    navigate(
      {
        pathname: '/question-bank',
        search: next === 'admission' ? '?mode=admission' : '',
      },
      { replace: true }
    );
  };

  const switchTab = (next: HubTab) => {
    if (next === tab) return;
    const params = new URLSearchParams(location.search);
    params.set('by', next);
    navigate({ pathname: '/question-bank', search: params.toString() }, { replace: true });
  };

  const handleBack = () => {
    if (window.history.state?.idx > 0) {
      navigate(-1);
      return;
    }
    navigate('/dashboard/home');
  };

  if (bankMode.mode === 'neutral') {
    if (stageStatus === 'error' && stage === null) {
      return (
        <div className="min-h-full bg-app pb-24 pt-3">
          <div className="mx-auto w-full max-w-3xl">
            <HubError message={t('questionBank.hub.loadError')} onRetry={() => void refresh()} />
          </div>
        </div>
      );
    }
    return <HubSkeleton />;
  }

  if (isPending) return <HubSkeleton />;

  return (
    <PullToRefresh onRefresh={() => refetch()}>
      <div ref={pageRef} className="min-h-full bg-app pb-24">
        <div className="mx-auto w-full max-w-3xl pt-1">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleBack}
              aria-label={t('questionBank.hub.back')}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-text-secondary transition-colors active:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <h1 className="text-[17px] font-extrabold text-text-primary">
              {t('questionBank.hub.title')}
            </h1>
            {isFetching && !isPending && (
              <span className="ml-auto text-[11px] font-medium text-text-secondary">
                {t('questionBank.loadingMore')}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              navigate(hubSearchHref(activeMode ?? 'hsc'), { state: { focusSearch: true } })
            }
            className="mt-2 flex h-11 w-full items-center gap-2 rounded-2xl border border-border-color bg-surface px-3.5 text-left transition-colors active:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <Search className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
            <span className="truncate text-[13px] font-medium text-text-secondary">
              {t('questionBank.hub.searchPlaceholder')}
            </span>
          </button>

          {bankMode.canSwitchLevel && (
            <div
              role="tablist"
              aria-label={t('questionBank.level')}
              className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1"
            >
              {(['hsc', 'admission'] as const).map((value) => {
                const active = (activeMode ?? 'hsc') === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => switchMode(value)}
                    className={`h-11 rounded-xl text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                      active
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-text-secondary'
                    }`}
                  >
                    {value === 'hsc'
                      ? t('questionBank.levelHsc')
                      : t('questionBank.levelAdmission')}
                  </button>
                );
              })}
            </div>
          )}

          {/* Floating grouping control: stays reachable while the grid scrolls. */}
          <div className="sticky top-0 z-20 -mx-1 mt-3 bg-app/95 px-1 pb-2 pt-1 backdrop-blur-md">
            <div
              role="tablist"
              className="grid grid-cols-3 gap-1 rounded-full border border-card-border bg-card-bg/95 p-1 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.55)]"
            >
              {HUB_TABS.map(({ id, labelKey, Icon }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => switchTab(id)}
                    className={`flex h-10 items-center justify-center gap-1.5 rounded-full text-[11.5px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                      active
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-text-secondary active:bg-surface'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{t(labelKey)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {isError ? (
            <div className="mt-2">
              <HubError
                message={t('questionBank.hub.loadError')}
                onRetry={() => void refetch()}
              />
            </div>
          ) : activeMode === 'hsc' ? (
            <HscHub payload={payload} tab={tab} />
          ) : (
            <AdmissionHub payload={payload} tab={tab} />
          )}
        </div>
      </div>
    </PullToRefresh>
  );
}

function HubError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useLanguage();

  return (
    <div
      role="alert"
      className="rounded-2xl border border-border-color bg-card-bg px-4 py-6 text-center"
    >
      <p className="text-[13px] font-semibold leading-relaxed text-text-primary">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border-color bg-surface px-4 text-[12px] font-bold text-text-primary transition-colors active:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        {t('questionBank.tryAgain')}
      </button>
    </div>
  );
}

function EmptyHub() {
  const { t } = useLanguage();

  return (
    <div className="mt-2 rounded-2xl border border-border-color bg-card-bg px-4 py-8 text-center">
      <p className="text-[13px] font-semibold text-text-primary">
        {t('questionBank.hub.emptyTitle')}
      </p>
      <p className="mt-1.5 text-[12px] leading-relaxed text-text-secondary">
        {t('questionBank.hub.emptyBody')}
      </p>
    </div>
  );
}

function AllAdmissionRow({ count }: { count: number }) {
  const { t } = useLanguage();

  return (
    <HubRowList>
      <HubRow
        label={t('questionBank.hub.allAdmission')}
        count={count}
        href={hubAllAdmissionHref()}
      />
    </HubRowList>
  );
}

function HscHub({ payload, tab }: { payload: QuestionBankHubPayload; tab: HubTab }) {
  const { t, language } = useLanguage();

  const subjects = findSection(payload, 'hsc_subjects');
  const boards = findSection(payload, 'hsc_boards');
  const colleges = findSection(payload, 'hsc_colleges');

  const hasAny =
    (subjects?.rows.length ?? 0) > 0 ||
    (boards?.rows.length ?? 0) > 0 ||
    (colleges?.rows.length ?? 0) > 0;

  if (!hasAny) return <EmptyHub />;

  if (tab === 'subject') {
    const rows = [...(subjects?.rows ?? [])].sort(byCountThenName);
    if (rows.length === 0) return <EmptyHub />;

    return (
      <div className="mt-2 space-y-4">
        <p className="px-1 text-[11px] font-medium text-text-secondary">
          {t('questionBank.hub.subjectMeta', {
            count: localizeDigits(rows.length, language),
          })}
        </p>
        <HubGrid>
          {rows.map((row) => (
            <HubGridTile
              key={row.id}
              href={hubSubjectHref(row.id)}
              label={row.labelBn}
              meta={language === 'en' ? null : row.labelEn}
              count={row.count}
            />
          ))}
        </HubGrid>
      </div>
    );
  }

  if (tab === 'institution') {
    const rows = [...(colleges?.rows ?? [])].sort(byCountThenName);
    if (rows.length === 0) return <EmptyHub />;

    return (
      <div className="mt-2 space-y-3">
        <p className="px-1 text-[11px] font-medium text-text-secondary">
          {t('questionBank.hub.collegeMeta', {
            count: localizeDigits(rows.length, language),
          })}
        </p>
        <HubGrid>
          {rows.map((row) => (
            <HubGridTile
              key={row.id}
              href={hubInstitutionHref(row.id)}
              label={row.labelBn}
              count={row.count}
            />
          ))}
        </HubGrid>
        <Link
          to={hubAllCollegesHref()}
          className="flex min-h-11 items-center justify-center rounded-2xl border border-card-border bg-card-bg px-3.5 text-[12.5px] font-bold text-text-primary transition-colors active:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          {t('questionBank.hub.allColleges', {
            count: localizeDigits(colleges?.rows.length ?? 0, language),
          })}
        </Link>
      </div>
    );
  }

  const boardRows = [...(boards?.rows ?? [])].sort(byCountThenName);
  if (boardRows.length === 0) return <EmptyHub />;

  return (
    <div className="mt-2 space-y-4">
      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2 px-1">
          <h2 className="text-[13px] font-extrabold text-text-primary">
            {t('questionBank.hub.sectionBoards')}
          </h2>
          <span className="text-[11px] font-medium text-text-secondary">
            {t('questionBank.hub.boardMeta', {
              count: localizeDigits(boardRows.length, language),
            })}
          </span>
        </div>
        <HubGrid>
          {boardRows.map((row) => (
            <HubGridTile
              key={row.id}
              href={hubInstitutionHref(row.id)}
              label={row.labelBn}
              count={row.count}
            />
          ))}
        </HubGrid>
      </section>
    </div>
  );
}

function AdmissionHub({
  payload,
  tab,
}: {
  payload: QuestionBankHubPayload;
  tab: HubTab;
}) {
  const { t, language } = useLanguage();

  const logoById = useUniversityLogoMap(true);
  const allAdmission = findSection(payload, 'all_admission');
  const tracks = payload.sections.filter(
    (section): section is Extract<typeof section, { kind: 'track' }> =>
      section.kind === 'track'
  );

  const primary = tracks.find((section) => section.primary) ?? null;
  const varsity = tracks.find((section) => section.track === 'varsity') ?? null;

  if (tracks.length === 0) return <EmptyHub />;

  if (tab === 'subject') {
    const subjects = [...(primary?.subjects ?? [])].sort(byCountThenName);
    if (subjects.length === 0) return <EmptyHub />;

    return (
      <div className="mt-2 space-y-3">
        <p className="px-1 text-[11px] font-medium text-text-secondary">
          {t('questionBank.hub.subjectMeta', {
            count: localizeDigits(subjects.length, language),
          })}
        </p>
        <HubGrid>
          {subjects.map((row) => (
            <HubGridTile
              key={row.id}
              href={hubAdmissionSubjectHref(row.id)}
              label={row.labelBn}
              count={row.count}
            />
          ))}
        </HubGrid>
        {allAdmission && <AllAdmissionRow count={allAdmission.count} />}
      </div>
    );
  }

  if (tab === 'institution') {
    const universities = [...(varsity?.universities ?? [])].sort(byCountThenName);
    if (universities.length === 0) return <EmptyHub />;

    return (
      <div className="mt-2 space-y-3">
        <p className="px-1 text-[11px] font-medium text-text-secondary">
          {t('questionBank.hub.allUniversities', {
            count: localizeDigits(varsity?.universityTotal ?? universities.length, language),
          })}
        </p>
        <HubGrid>
          {universities.map((row) => (
            <HubUniversityCard
              key={row.id}
              row={row}
              logoUrl={logoById[row.id] ?? null}
            />
          ))}
        </HubGrid>
        {allAdmission && <AllAdmissionRow count={allAdmission.count} />}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-4">
      {primary && <GoalBanner section={primary} />}

      <HubGrid>
        {[...tracks]
          .sort((a, b) => Number(b.primary) - Number(a.primary))
          .map((section) => (
            <HubGridTile
              key={section.track}
              href={hubTrackHref(section.track)}
              label={t(trackLabelKey(section.track))}
              icon={trackIcon(section.track)}
              count={section.count}
              tone={section.primary ? 'primary' : 'plain'}
            />
          ))}
      </HubGrid>

      {allAdmission && <AllAdmissionRow count={allAdmission.count} />}

      {primary && primary.count === 0 && (
        <div className="rounded-2xl border border-border-color bg-card-bg p-4">
          <p className="text-[13px] font-semibold text-text-primary">
            {t('questionBank.hub.goalEmptyTitle')}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">
            {t('questionBank.hub.goalEmptyBody')}
          </p>
          <Link
            to={hubAllAdmissionHref()}
            className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-[12.5px] font-bold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {t('questionBank.hub.seeAllAdmission')}
          </Link>
        </div>
      )}

      {primary && isThinTrack(primary.count) && (
        <p className="px-1 text-[11px] font-medium leading-relaxed text-text-secondary">
          {t('questionBank.hub.comingSoon')}
        </p>
      )}
    </div>
  );
}

/** The student's own goal, kept as one quiet line above the exam grid. */
function GoalBanner({
  section,
}: {
  section: Extract<QuestionBankHubPayload['sections'][number], { kind: 'track' }>;
}) {
  const { t, language } = useLanguage();

  return (
    <div className="flex items-center justify-between gap-3 rounded-[20px] border border-primary/25 bg-primary/[0.05] px-3.5 py-3">
      <div className="min-w-0">
        <p className="text-[10.5px] font-bold text-primary">
          {t('questionBank.hub.goalKicker')}
        </p>
        <p className="mt-0.5 truncate text-[15px] font-extrabold text-text-primary">
          {t(trackLabelKey(section.track))}
        </p>
      </div>
      <span className="shrink-0 text-[11px] font-bold tabular-nums text-text-secondary">
        {t('questionBank.hub.questionMeta', {
          count: localizeDigits(section.count, language),
        })}
      </span>
    </div>
  );
}
