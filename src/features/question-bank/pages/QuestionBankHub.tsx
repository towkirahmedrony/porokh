import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, RefreshCw, Search } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import { PullToRefresh } from '@/features/groups/components/PullToRefresh';
import { useStage } from '@/features/stage/hooks/useStage';
import { resolveBankMode } from '../utils/bankMode';
import { useQuestionBankHub } from '../hooks/useQuestionBankHub';
import {
  findSection,
  hasMoreColleges,
  hubAdmissionSubjectHref,
  hubAllAdmissionHref,
  hubAllCollegesHref,
  hubAllUniversitiesHref,
  hubCollegeRows,
  hubInstitutionHref,
  hubSearchHref,
  hubSubjectHref,
  hubTrackHref,
  hubUniversityPageHref,
  hubUniversityRows,
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
import { HubSection } from '../components/hub/HubSection';
import { HubSkeleton } from '../components/hub/HubSkeleton';
import { HubSubjectSheet } from '../components/hub/HubSubjectSheet';

/**
 * The entrance to the question bank.
 *
 * The list is unchanged and still lives at /question-bank/list; this screen is
 * what a student sees first, ordered by their own stage and goal. Every number
 * on it comes from the server's hub payload, and every row opens the list with
 * the filters that produced that number.
 *
 * Stage handling mirrors the list on purpose: a stage that has not arrived is a
 * skeleton, never a guess. The one difference is a failed stage refresh with a
 * previously cached answer: the last server answer is used rather than hiding
 * the bank behind a spinner forever.
 */

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

  const [subjectsOpen, setSubjectsOpen] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const restoredKeyRef = useRef('');

  const activeMode = payload.mode ?? requestedMode;
  const sessionKey = questionBankSessionKey(location.pathname, location.search);

  // The hub is a page students return to after every drill-down, so its scroll
  // position is restored the way the list restores its own. It waits for the
  // payload: restoring before the rows exist would scroll a short page to the
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
        <div className="min-h-full bg-app px-4 pb-24 pt-3">
          <div className="mx-auto max-w-2xl">
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
        <div className="mx-auto max-w-2xl px-4 pt-2">
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

          {isError ? (
            <div className="mt-4">
              <HubError
                message={t('questionBank.hub.loadError')}
                onRetry={() => void refetch()}
              />
            </div>
          ) : activeMode === 'hsc' ? (
            <HscHub payload={payload} />
          ) : (
            <AdmissionHub
              payload={payload}
              onOpenSubjects={() => setSubjectsOpen(true)}
            />
          )}
        </div>
      </div>

      <HubSubjectSheet
        open={subjectsOpen}
        rows={subjectsOf(payload)}
        onClose={() => setSubjectsOpen(false)}
        onSelect={(subjectId) => {
          setSubjectsOpen(false);
          navigate(hubAdmissionSubjectHref(subjectId));
        }}
      />
    </PullToRefresh>
  );
}

function subjectsOf(payload: QuestionBankHubPayload): QuestionBankHubRow[] {
  const track = payload.sections.find(
    (section) => section.kind === 'track' && section.primary
  );
  return track && track.kind === 'track' ? track.subjects : [];
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
    <div className="mt-4 rounded-2xl border border-border-color bg-card-bg px-4 py-8 text-center">
      <p className="text-[13px] font-semibold text-text-primary">
        {t('questionBank.hub.emptyTitle')}
      </p>
      <p className="mt-1.5 text-[12px] leading-relaxed text-text-secondary">
        {t('questionBank.hub.emptyBody')}
      </p>
    </div>
  );
}

function HscHub({ payload }: { payload: QuestionBankHubPayload }) {
  const { t, language } = useLanguage();

  const subjects = findSection(payload, 'hsc_subjects');
  const boards = findSection(payload, 'hsc_boards');
  const colleges = findSection(payload, 'hsc_colleges');

  const collegeRows = colleges ? hubCollegeRows(colleges.rows) : [];
  const hasAny =
    (subjects?.rows.length ?? 0) > 0 ||
    (boards?.rows.length ?? 0) > 0 ||
    collegeRows.length > 0;

  if (!hasAny) return <EmptyHub />;

  return (
    <div className="mt-4 space-y-5">
      {subjects && subjects.rows.length > 0 && (
        <HubSection
          title={t('questionBank.hub.sectionSubjects')}
          meta={t('questionBank.hub.subjectMeta', {
            count: localizeDigits(subjects.rows.length, language),
          })}
        >
          <HubRowList>
            {subjects.rows.map((row) => (
              <HubRow
                key={row.id}
                label={row.labelBn}
                count={row.count}
                href={hubSubjectHref(row.id)}
              />
            ))}
          </HubRowList>
        </HubSection>
      )}

      {boards && boards.rows.length > 0 && (
        <HubSection
          title={t('questionBank.hub.sectionBoards')}
          meta={t('questionBank.hub.boardMeta', {
            count: localizeDigits(boards.rows.length, language),
          })}
        >
          <HubRowList>
            {boards.rows.map((row) => (
              <HubRow
                key={row.id}
                label={row.labelBn}
                count={row.count}
                href={hubInstitutionHref(row.id)}
              />
            ))}
          </HubRowList>
        </HubSection>
      )}

      {colleges && collegeRows.length > 0 && (
        <HubSection
          title={t('questionBank.hub.sectionColleges')}
          meta={t('questionBank.hub.collegeMeta', {
            count: localizeDigits(colleges.rows.length, language),
          })}
        >
          <HubRowList>
            {collegeRows.map((row) => (
              <HubRow
                key={row.id}
                label={row.labelBn}
                count={row.count}
                href={hubInstitutionHref(row.id)}
              />
            ))}
            {hasMoreColleges(colleges.rows) && (
              <HubRow
                label={t('questionBank.hub.allColleges', {
                  count: localizeDigits(colleges.rows.length, language),
                })}
                href={hubAllCollegesHref()}
              />
            )}
          </HubRowList>
        </HubSection>
      )}
    </div>
  );
}

function AdmissionHub({
  payload,
  onOpenSubjects,
}: {
  payload: QuestionBankHubPayload;
  onOpenSubjects: () => void;
}) {
  const { t, language } = useLanguage();

  const allAdmission = findSection(payload, 'all_admission');
  const tracks = payload.sections.filter(
    (section): section is Extract<typeof section, { kind: 'track' }> =>
      section.kind === 'track'
  );

  if (tracks.length === 0) return <EmptyHub />;

  return (
    <div className="mt-4 space-y-5">
      {allAdmission && (
        <HubRowList className="border-primary/25 bg-primary/[0.04]">
          <HubRow
            label={t('questionBank.hub.allAdmission')}
            count={allAdmission.count}
            href={hubAllAdmissionHref()}
          />
        </HubRowList>
      )}

      {tracks.map((section) =>
        section.primary ? (
          <GoalTrackCard
            key={section.track}
            section={section}
            onOpenSubjects={onOpenSubjects}
          />
        ) : section.track === 'varsity' ? (
          <HubSection
            key={section.track}
            title={t(trackLabelKey('varsity'))}
            meta={t('questionBank.hub.questionMeta', {
              count: localizeDigits(section.count, language),
            })}
          >
            <HubRowList>
              {hubUniversityRows(section.universities).map((row) => (
                <HubRow
                  key={row.id}
                  label={row.labelBn}
                  count={row.count}
                  href={hubUniversityPageHref(row.id)}
                />
              ))}
              {section.universityTotal > hubUniversityRows(section.universities).length && (
                <HubRow
                  label={t('questionBank.hub.allUniversities', {
                    count: localizeDigits(section.universityTotal, language),
                  })}
                  href={hubAllUniversitiesHref()}
                />
              )}
            </HubRowList>
          </HubSection>
        ) : (
          <HubRowList key={section.track}>
            <HubRow
              label={t(trackLabelKey(section.track))}
              count={section.count}
              href={hubTrackHref(section.track)}
            />
          </HubRowList>
        )
      )}
    </div>
  );
}

function GoalTrackCard({
  section,
  onOpenSubjects,
}: {
  section: Extract<QuestionBankHubPayload['sections'][number], { kind: 'track' }>;
  onOpenSubjects: () => void;
}) {
  const { t, language } = useLanguage();
  const title = t(trackLabelKey(section.track));
  const countLabel = localizeDigits(section.count, language);

  return (
    <section className="rounded-[22px] border border-primary/25 bg-primary/[0.05] p-3.5">
      <header className="flex items-start justify-between gap-3 px-0.5">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-primary">
            {t('questionBank.hub.goalKicker')}
          </p>
          <h2 className="mt-0.5 truncate text-[18px] font-extrabold leading-snug text-text-primary">
            {title}
          </h2>
        </div>
        <span className="shrink-0 pt-3 text-[12px] font-bold tabular-nums text-text-secondary">
          {t('questionBank.hub.questionMeta', { count: countLabel })}
        </span>
      </header>

      {section.count === 0 ? (
        <div className="mt-3 rounded-2xl bg-card-bg p-4">
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
      ) : (
        <div className="mt-3 space-y-2">
          {section.track === 'varsity' ? (
            <>
              <HubRowList>
                {hubUniversityRows(section.universities).map((row) => (
                  <HubRow
                    key={row.id}
                    label={row.labelBn}
                    count={row.count}
                    href={hubUniversityPageHref(row.id)}
                  />
                ))}
                {section.universityTotal > hubUniversityRows(section.universities).length && (
                  <HubRow
                    label={t('questionBank.hub.allUniversities', {
                      count: localizeDigits(section.universityTotal, language),
                    })}
                    href={hubAllUniversitiesHref()}
                  />
                )}
              </HubRowList>
            </>
          ) : (
            <HubRowList>
              <HubRow
                label={t('questionBank.hub.openTrack', { track: title })}
                count={section.count}
                href={hubTrackHref(section.track)}
              />
            </HubRowList>
          )}

          {/* The RPC attaches the level-wide subject counts to the goal section
              only; the compact sections stay one row each. */}
          {section.subjects.length > 0 && (
            <HubRowList>
              <HubRow
                label={t('questionBank.hub.bySubject')}
                hint={t('questionBank.hub.bySubjectHint')}
                onClick={onOpenSubjects}
              />
            </HubRowList>
          )}

          {isThinTrack(section.count) && (
            <p className="px-1 text-[11px] font-medium leading-relaxed text-text-secondary">
              {t('questionBank.hub.comingSoon')}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
