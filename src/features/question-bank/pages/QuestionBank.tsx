import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import {
  BookOpen,
  ChevronLeft,
  Filter,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Card } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui/Button';
import { Loader } from '@/shared/components/feedback/Loader';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import QuestionCard from '../components/QuestionCard';
import { BankLevelBar } from '../components/BankLevelBar';
import { BankFilterSheet } from '../components/BankFilterSheet';
import { BankGoalEmptyState } from '../components/BankGoalEmptyState';
import { useStage } from '@/features/stage/hooks/useStage';
import { needsGoalEmptyState, resolveBankMode } from '../utils/bankMode';
import { withAdmissionDefaults } from '../utils/questionBankUrlState';
import { FloatingAnswerButton } from '@/shared/components/filters/FloatingAnswerButton';
import { useQuestionBank } from '../hooks/useQuestionBank';
import { describeQuestionBankError } from '../services/questionBankErrors';
import { localizedText } from '../services/questionBankMapper';
import { LEGACY_ROW_CAP } from '../services/questionBankService';
import {
  INITIAL_REVEAL_STATE,
  isExplanationExpanded,
  revealReducer,
} from '../utils/answerVisibility';
import type { QuestionBankFilterState } from '../types/questionBank';
import {
  readQuestionBankSession,
  writeQuestionBankSession,
} from '../utils/questionBankSession';

function getScrollParent(element: HTMLElement | null): HTMLElement | null {
  let node = element?.parentElement ?? null;
  while (node) {
    const overflowY = window.getComputedStyle(node).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
    node = node.parentElement;
  }
  return null;
}

function InfoBadge(props: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border-color bg-surface px-2 py-0.5 text-[10px] font-medium text-text-secondary">
      {props.children}
    </span>
  );
}

/** Shown while the server's stage has not decided the bank yet. */
function BankSkeleton() {
  return (
    <div className="min-h-full bg-app px-4 pt-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-3">
        <div className="h-11 animate-pulse rounded-2xl bg-surface" />
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-[20px] border border-card-border bg-card-bg"
          />
        ))}
      </div>
    </div>
  );
}

export default function QuestionBank() {
  const { t, language } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  // The server's stage decides which bank this student gets. The page never
  // guesses it and never derives it from a date.
  const { stage, goal, status: stageStatus } = useStage();
  const bankMode = resolveBankMode({ stage, goal, status: stageStatus });

  const {
    filters,
    updateFilter,
    replaceFilters,
    resetFilters,
    openSubject,
    hasView,
    isInvalidSubject,
    sessionKey,
    isPaginationRestored,
    subjects,
    boards,
    colleges,
    admissions,
    questions,
    total,
    capped,
    facets,
    isLoading,
    isQuestionsLoaded,
    isFetching,
    isFetchingNextPage,
    hasMore,
    loadMore,
    error,
    refetch,
    toggleBookmark,
    bookmarkUpdatingId,
    answerKeys,
    isAnswersFetching,
  } = useQuestionBank();

  const pageRef = useRef<HTMLDivElement>(null);
  const restoredScrollKeyRef = useRef('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showInvalidSubjectNotice, setShowInvalidSubjectNotice] = useState(false);
  const [revealState, dispatchReveal] = useReducer(
    revealReducer,
    INITIAL_REVEAL_STATE
  );
  const answersRevealed = revealState.answersRevealed;

  // The level and the track are the tab, not filters: they are why the badge
  // counts zero on a fresh admission screen.
  const activeFilterCount = useMemo(() => {
    return [
      filters.search,
      filters.subjectId,
      filters.chapterId,
      filters.topicId,
      filters.universityId,
      filters.admissionUnitId,
      filters.year,
      filters.bookmarkedOnly ? 'bookmarked' : '',
      filters.mistakesOnly ? 'mistakes' : '',
      filters.premiumOnly ? 'premium' : '',
    ].filter(Boolean).length;
  }, [filters]);

  // Only the HSC tab browses by subject first. Admission browsing opens on the
  // list itself: the university and the goal are the way in, not a subject, and
  // a studying student's Admission tab must not fall back to the HSC picker.
  const isSubjectSelectionMode =
    bankMode.mode === 'hsc' &&
    filters.level === 'hsc' &&
    (!hasView || isInvalidSubject);

  const isGoalEmpty =
    activeFilterCount === 0 &&
    // Only a successful response may claim the track has no questions; a
    // pending or failed request must never borrow this state.
    isQuestionsLoaded &&
    needsGoalEmptyState(
      bankMode,
      filters.level,
      total,
      filters.allTracks,
      isQuestionsLoaded
    );

  const institutionName = useMemo(() => {
    if (!filters.institutionEiin) return '';
    const match = [...boards, ...colleges, ...admissions].find(
      (inst) => (inst.eiin || inst.code || inst.id) === filters.institutionEiin
    );
    if (!match) return t('questionBank.unknownValue');
    return localizedText(match.name_bn, match.name_en, language);
  }, [admissions, boards, colleges, filters.institutionEiin, language, t]);

  const errorKey = error ? describeQuestionBankError(error) : null;

  const resetRevealState = () => {
    dispatchReveal({ type: 'reset' });
  };

  // A different subject (or returning to the list) starts with answers hidden.
  useEffect(() => {
    dispatchReveal({ type: 'reset' });
  }, [filters.subjectId]);

  // An invalid subject in a copied URL falls back to the subject list instead
  // of an empty or crashing question view.
  useEffect(() => {
    if (!isInvalidSubject) return;
    setShowInvalidSubjectNotice(true);
    dispatchReveal({ type: 'reset' });
    resetFilters();
  }, [isInvalidSubject, resetFilters]);

  // Restore scroll only after pagination has been rebuilt, otherwise the list
  // is still too short to scroll to the saved offset.
  useEffect(() => {
    if (isSubjectSelectionMode || !isPaginationRestored || isLoading) return;
    if (restoredScrollKeyRef.current === sessionKey) return;

    const stored = readQuestionBankSession(sessionKey);

    const frame = window.requestAnimationFrame(() => {
      restoredScrollKeyRef.current = sessionKey;
      const container = getScrollParent(pageRef.current);
      container?.scrollTo({ top: stored?.scrollY ?? 0 });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isSubjectSelectionMode, isPaginationRestored, isLoading, sessionKey]);

  // Scroll position is tiny and URL-keyed; answers/explanations stay in memory
  // only, so a refresh always reveals a clean list.
  useEffect(() => {
    if (isSubjectSelectionMode) return;
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
  }, [isSubjectSelectionMode, sessionKey]);

  const handleOpenSubject = (subjectId: string) => {
    resetRevealState();
    setShowInvalidSubjectNotice(false);
    openSubject(subjectId);
  };

  const handleBack = () => {
    resetRevealState();
    const fromSubjects = Boolean(
      (location.state as { fromQuestionBankSubjects?: boolean } | null)
        ?.fromQuestionBankSubjects
    );
    if (fromSubjects) {
      navigate(-1);
      return;
    }
    navigate('/question-bank');
  };

  const handleFilterChange = <K extends keyof QuestionBankFilterState>(
    key: K,
    value: QuestionBankFilterState[K]
  ) => {
    resetRevealState();
    updateFilter(key, value);
  };

  const handleResetFilters = () => {
    resetRevealState();
    resetFilters();
  };

  // The URL is the single source of truth for the tab, so the stage rule is
  // written there once. An admission-prep student whose URL says hsc is moved
  // to admission and their goal becomes the default track in a single write; a
  // studying student is never moved off HSC, but their Admission tab still
  // opens on their goal track.
  useEffect(() => {
    const tab = bankMode.mode === 'admission' ? 'admission' : filters.level;
    if (tab !== 'admission') return;

    const next = withAdmissionDefaults(filters, bankMode.defaultTrack);
    if (next === filters) return;

    resetRevealState();
    replaceFilters(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankMode.mode, bankMode.defaultTrack, filters, replaceFilters]);

  // A failed list request used to render as an empty list. It now renders as an
  // error, and this is the log that makes the failure visible in a device
  // console instead of only as a zero count.
  useEffect(() => {
    if (!error) return;
    console.error('[question-bank] list request failed', {
      level: filters.level,
      track: filters.track,
      allTracks: filters.allTracks,
      error,
    });
  }, [error, filters.level, filters.track, filters.allTracks]);

  const handleRefetch = () => {
    resetRevealState();
    void refetch();
  };

  const toggleAnswersRevealed = () => {
    dispatchReveal({ type: 'toggle-answers' });
  };

  const toggleQuestionExplanation = (questionId: string) => {
    dispatchReveal({ type: 'toggle-explanation', questionId });
  };

  // A half-known stage shows neither bank. Guessing would paint content the
  // student may not be allowed to see, and a spinner that resolves to the wrong
  // tab is worse than a second of skeletons.
  if (bankMode.mode === 'neutral') {
    return <BankSkeleton />;
  }

  // A stale level in the URL is rewritten above, after paint. Rendering the
  // list in the meantime would show an HSC screen to an admission student, so
  // the skeleton holds until the URL agrees with the server's stage.
  if (bankMode.mode === 'admission' && filters.level !== 'admission') {
    return <BankSkeleton />;
  }

  return (
    <div
      ref={pageRef}
      className={`min-h-full bg-app px-4 pt-4 text-text-primary sm:px-6 lg:px-8 ${
        isSubjectSelectionMode ? 'pb-4' : 'pb-24 md:pb-20'
      }`}
    >
      <div className="mx-auto max-w-7xl">
        {isSubjectSelectionMode ? (
          <section className="space-y-4">
            {(showInvalidSubjectNotice || isInvalidSubject) && (
              <div
                role="status"
                className="rounded-2xl border border-border-color bg-surface px-3 py-2 text-[11px] font-medium text-text-secondary"
              >
                {t('questionBank.invalidSubject')}
              </div>
            )}

            <div className="flex items-center justify-between border-b border-border-color pb-2">
              <h2 className="text-lg font-bold text-text-primary">
                {t('questionBank.selectSubject')}
              </h2>
              <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-bold text-text-secondary">
                {t('questionBank.subjectCount', {
                  count: localizeDigits(subjects.length, language),
                })}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {subjects.map((subject) => (
                <Card
                  key={subject.id}
                  onClick={() => handleOpenSubject(subject.id)}
                  className="group cursor-pointer rounded-[20px] border border-card-border bg-card-bg p-4 text-center shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary hover:shadow-md"
                >
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <h3 className="line-clamp-1 text-[13px] font-bold text-text-primary">
                    {localizedText(subject.name_bn, subject.name_en, language)}
                  </h3>
                  {language === 'bn' && subject.name_en && (
                    <p className="mt-0.5 line-clamp-1 text-[10px] text-text-secondary opacity-70">
                      {subject.name_en}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          </section>
        ) : (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-border-color pb-2">
              <Button
                variant="ghost"
                onClick={handleBack}
                className="h-8 rounded-full px-2 text-xs font-bold text-text-secondary hover:text-text-primary"
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                {t('questionBank.back')}
              </Button>

              <Button
                variant="outline"
                onClick={() => setIsFilterOpen((current) => !current)}
                className="inline-flex h-9 min-w-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold"
                aria-expanded={isFilterOpen}
                aria-controls="question-bank-filters"
              >
                <Filter className="h-3.5 w-3.5" />
                {isFilterOpen
                  ? t('questionBank.closeFilters')
                  : t('questionBank.openFilters')}
                {activeFilterCount > 0 && (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/10 px-1 text-[10px] font-bold text-primary">
                    {localizeDigits(activeFilterCount, language)}
                  </span>
                )}
              </Button>
            </div>

            <BankLevelBar
              level={filters.level}
              canSwitchLevel={bankMode.canSwitchLevel}
              allTracks={filters.allTracks}
              admissionTotal={null}
              onChangeLevel={(next) => handleFilterChange('level', next)}
              onToggleAllTracks={() =>
                handleFilterChange('allTracks', !filters.allTracks)
              }
            />

            <div className="grid gap-4">
              <main className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11px] font-medium leading-snug text-text-secondary">
                  <span className="font-bold text-text-primary">
                    {t('questionBank.results')}:
                  </span>
                  <span>
                    {t('questionBank.showingCount', {
                      shown: localizeDigits(questions.length, language),
                      total: localizeDigits(total, language),
                    })}
                    {activeFilterCount > 0
                      ? ` • ${t('questionBank.filters', {
                          count: localizeDigits(activeFilterCount, language),
                        })}`
                      : ''}
                  </span>

                  {isFetching && !isFetchingNextPage && (
                    <span>{t('questionBank.loadingMore')}</span>
                  )}

                  {filters.institutionType && (
                    <InfoBadge>
                      {t('questionBank.sourceLabel', {
                        source:
                          filters.institutionType === 'board'
                            ? t('questionBank.board')
                            : filters.institutionType === 'college'
                              ? t('questionBank.college')
                              : t('questionBank.admission'),
                      })}
                    </InfoBadge>
                  )}

                  {filters.institutionEiin && (
                    <InfoBadge>
                      {t('questionBank.name')} {institutionName}
                    </InfoBadge>
                  )}

                  {filters.year && (
                    <InfoBadge>
                      {t('questionBank.year')}:{' '}
                      {localizeDigits(filters.year, language)}
                    </InfoBadge>
                  )}
                  {filters.bookmarkedOnly && (
                    <InfoBadge>{t('questionBank.savedFilter')}</InfoBadge>
                  )}
                  {filters.mistakesOnly && (
                    <InfoBadge>{t('questionBank.mistakesFilter')}</InfoBadge>
                  )}
                  {filters.premiumOnly && (
                    <InfoBadge>{t('questionBank.premium')}</InfoBadge>
                  )}
                </div>

                {isLoading ? (
                  <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-card-border bg-card-bg">
                    <Loader />
                  </div>
                ) : errorKey ? (
                  <div className="rounded-2xl border border-border-color bg-card-bg p-6">
                    <div className="space-y-3 text-center">
                      <h3 className="text-sm font-bold text-text-primary">
                        {t('questionBank.error')}
                      </h3>
                      <p className="text-[11px] font-medium text-text-secondary">
                        {t(errorKey)}
                      </p>
                      <Button
                        variant="ghost"
                        className="mx-auto h-9 rounded-xl px-3 text-xs font-bold"
                        onClick={handleRefetch}
                      >
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                        {t('questionBank.tryAgain')}
                      </Button>
                    </div>
                  </div>
                ) : questions.length === 0 ? (
                  isGoalEmpty ? (
                    <BankGoalEmptyState
                      onShowAllAdmission={() =>
                        handleFilterChange('allTracks', true)
                      }
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Search className="mb-3 h-10 w-10 text-text-secondary opacity-30" />
                      <EmptyState
                        title={
                          activeFilterCount > 0
                            ? t('questionBank.noMatch')
                            : t('questionBank.empty')
                        }
                      />
                      {activeFilterCount > 0 && (
                        <Button
                          variant="ghost"
                          className="mt-3 h-9 rounded-xl px-3 text-xs font-bold"
                          onClick={handleResetFilters}
                        >
                          {t('questionBank.reset')}
                        </Button>
                      )}
                    </div>
                  )
                ) : (
                  <div className="space-y-2.5">
                    {questions.map((question) => (
                      <QuestionCard
                        key={question.id}
                        question={question}
                        language={language}
                        correctOptionIds={answerKeys.get(question.id) ?? null}
                        answersRevealed={answersRevealed}
                        isExplanationVisible={isExplanationExpanded(
                          question.id,
                          revealState
                        )}
                        isAnswerKeyLoading={isAnswersFetching}
                        isBookmarkUpdating={
                          bookmarkUpdatingId === question.id
                        }
                        onToggleExplanation={toggleQuestionExplanation}
                        onBookmarkToggle={(questionId, isBookmarked) =>
                          toggleBookmark({ questionId, isBookmarked })
                        }
                      />
                    ))}

                    {capped && (
                      <p className="rounded-2xl border border-dashed border-border-color bg-surface px-3 py-2 text-[11px] font-medium text-text-secondary">
                        {t('questionBank.limitedNotice', {
                          count: localizeDigits(LEGACY_ROW_CAP, language),
                        })}
                      </p>
                    )}

                    {hasMore && (
                      <div className="flex justify-center pt-1">
                        <Button
                          className="h-10 rounded-xl px-5 text-xs font-bold"
                          disabled={isFetchingNextPage}
                          onClick={loadMore}
                        >
                          {isFetchingNextPage
                            ? t('questionBank.loadingMore')
                            : t('questionBank.loadMore')}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </main>
            </div>
          </section>
        )}
      </div>

      <BankFilterSheet
        open={isFilterOpen}
        facets={facets}
        filters={filters}
        activeCount={activeFilterCount}
        onClose={() => setIsFilterOpen(false)}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
      />

      {!isSubjectSelectionMode && questions.length > 0 && (
        <FloatingAnswerButton
          revealed={answersRevealed}
          onToggle={toggleAnswersRevealed}
        />
      )}
    </div>
  );
}
