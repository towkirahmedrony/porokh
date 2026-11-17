import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import {
  BookOpen,
  BookOpenCheck,
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
import { QuestionFilter } from '../components/QuestionFilter';
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

export default function QuestionBank() {
  const { t, language } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    filters,
    updateFilter,
    resetFilters,
    openSubject,
    hasView,
    isInvalidSubject,
    sessionKey,
    isPaginationRestored,
    subjects,
    chapters,
    topics,
    boards,
    colleges,
    admissions,
    questions,
    total,
    capped,
    isLoading,
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

  const activeFilterCount = useMemo(() => {
    return [
      filters.search,
      filters.subjectId,
      filters.chapterId,
      filters.topicId,
      filters.institutionType,
      filters.institutionEiin,
      filters.year,
      filters.bookmarkedOnly ? 'bookmarked' : '',
      filters.mistakesOnly ? 'mistakes' : '',
      filters.premiumOnly ? 'premium' : '',
    ].filter(Boolean).length;
  }, [filters]);

  // The URL decides the view; an unknown subject degrades to the subject list.
  const isSubjectSelectionMode = !hasView || isInvalidSubject;

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

  return (
    <div
      ref={pageRef}
      className={`min-h-full bg-app px-4 pt-4 text-text-primary sm:px-6 lg:px-8 ${
        isSubjectSelectionMode ? 'pb-4' : 'pb-16 md:pb-4'
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
                className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-bold xl:hidden"
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

            <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
              <aside className="space-y-3">
                <div
                  id="question-bank-filters"
                  className={`${isFilterOpen ? 'block' : 'hidden'} xl:block`}
                >
                  <QuestionFilter
                    filters={filters}
                    chapters={chapters}
                    topics={topics}
                    boards={boards}
                    colleges={colleges}
                    admissions={admissions}
                    onFilterChange={handleFilterChange}
                    onReset={handleResetFilters}
                  />
                </div>
              </aside>

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
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Search className="mb-3 h-10 w-10 text-text-secondary opacity-30" />
                    <EmptyState title={t('questionBank.empty')} />
                    <p className="mt-1 text-[11px] font-medium text-text-secondary">
                      {t('questionBank.tryAgain')}
                    </p>
                  </div>
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

      {!isSubjectSelectionMode && questions.length > 0 && (
        <button
          type="button"
          className={`fixed bottom-24 right-4 z-40 inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-xs font-bold shadow-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:scale-95 motion-reduce:transition-none md:bottom-6 md:right-6 ${
            answersRevealed
              ? 'border-emerald-600 bg-emerald-600 text-white shadow-emerald-600/25 hover:bg-emerald-700'
              : 'border-card-border bg-card-bg text-text-primary hover:bg-surface'
          }`}
          aria-pressed={answersRevealed}
          onClick={toggleAnswersRevealed}
        >
          {answersRevealed ? (
            <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
          ) : (
            <BookOpen className="h-4 w-4" aria-hidden="true" />
          )}
          {answersRevealed
            ? t('questionBank.readingModeActive')
            : t('questionBank.readingMode')}
        </button>
      )}
    </div>
  );
}
