import React, { useEffect, useMemo, useReducer, useState } from 'react';
import { Eye, EyeOff, RotateCcw } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import QuestionCard from '@/features/question-bank/components/QuestionCard';
import { dedupeQuestions } from '@/features/question-bank/services/questionBankMapper';
import {
  INITIAL_REVEAL_STATE,
  isExplanationExpanded,
  revealReducer,
} from '@/features/question-bank/utils/answerVisibility';
import {
  useAdmissionBank,
  useAdmissionBankAnswers,
  useAdmissionBookmark,
} from '../hooks/useAdmissionHub';
import {
  EMPTY_ADMISSION_BANK_FILTERS,
  type AdmissionBankFilters,
  type AdmissionUnitHubData,
} from '../types/admissionHub';
import { AdmissionState } from './AdmissionState';

interface AdmissionBankPanelProps {
  unitId: string;
  facets: AdmissionUnitHubData['bank'];
}

const selectClass =
  'w-full rounded-xl border border-input-border bg-input-bg px-2.5 py-2 text-xs font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-focus-ring';

const AdmissionBankPanel: React.FC<AdmissionBankPanelProps> = ({
  unitId,
  facets,
}) => {
  const { t, language } = useLanguage();
  const [filters, setFilters] = useState<AdmissionBankFilters>(
    EMPTY_ADMISSION_BANK_FILTERS
  );
  const [revealState, dispatchReveal] = useReducer(
    revealReducer,
    INITIAL_REVEAL_STATE
  );

  const bankQuery = useAdmissionBank(unitId, filters, true);
  const bookmarkMutation = useAdmissionBookmark();

  const pages = bankQuery.data?.pages;
  const questions = useMemo(
    () => dedupeQuestions((pages ?? []).flatMap((page) => page.questions)),
    [pages]
  );
  const total = pages?.[0]?.total ?? facets.total;

  const answerIds = useMemo(
    () =>
      questions.filter((question) => !question.isLocked).map((question) => question.id),
    [questions]
  );

  const answersQuery = useAdmissionBankAnswers(
    unitId,
    answerIds,
    revealState.answersRevealed
  );

  const answerKeys = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const key of answersQuery.data ?? []) {
      map.set(key.questionId, key.correctOptionIds);
    }
    return map;
  }, [answersQuery.data]);

  // A new filter set is a new question list, so answers start hidden again.
  useEffect(() => {
    dispatchReveal({ type: 'reset' });
  }, [filters.year, filters.subjectId, filters.topicId]);

  const subjects = facets.subjects;
  const topics = filters.subjectId
    ? facets.topics.filter((topic) => topic.subjectId === filters.subjectId)
    : facets.topics;

  const hasFilters = Boolean(
    filters.year || filters.subjectId || filters.topicId
  );

  const updateFilters = (patch: Partial<AdmissionBankFilters>) =>
    setFilters((previous) => ({ ...previous, ...patch }));

  const localizedName = (nameBn: string, nameEn: string | null) =>
    language === 'en' && nameEn ? nameEn : nameBn;

  const isLoadingFirstPage = bankQuery.isLoading;
  const isBookmarkUpdating = (questionId: string) =>
    bookmarkMutation.isPending &&
    bookmarkMutation.variables?.questionId === questionId;

  return (
    <div
      role="tabpanel"
      id="admission-hub-panel-bank"
      aria-labelledby="admission-hub-tab-bank"
      className="space-y-3"
    >
      <div className="rounded-2xl border border-card-border bg-card-bg p-3.5">
        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-1 block">
            <span className="mb-1 block text-[11px] font-bold text-text-secondary">
              {t('admission.hub.filterYear')}
            </span>
            <select
              value={filters.year}
              onChange={(event) => updateFilters({ year: event.target.value })}
              className={selectClass}
            >
              <option value="">{t('admission.hub.allYears')}</option>
              {facets.years.map((year) => (
                <option key={year.label} value={year.label}>
                  {localizeDigits(year.label, language)} (
                  {localizeDigits(year.count, language)})
                </option>
              ))}
            </select>
          </label>

          <label className="col-span-1 block">
            <span className="mb-1 block text-[11px] font-bold text-text-secondary">
              {t('admission.hub.filterSubject')}
            </span>
            <select
              value={filters.subjectId}
              onChange={(event) =>
                updateFilters({ subjectId: event.target.value, topicId: '' })
              }
              className={selectClass}
            >
              <option value="">{t('admission.hub.allSubjects')}</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {localizedName(subject.nameBn, subject.nameEn)} (
                  {localizeDigits(subject.questionCount, language)})
                </option>
              ))}
            </select>
          </label>

          <label className="col-span-2 block">
            <span className="mb-1 block text-[11px] font-bold text-text-secondary">
              {t('admission.hub.filterTopic')}
            </span>
            <select
              value={filters.topicId}
              onChange={(event) => updateFilters({ topicId: event.target.value })}
              className={selectClass}
            >
              <option value="">{t('admission.hub.allTopics')}</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {localizedName(topic.nameBn, topic.nameEn)} (
                  {localizeDigits(topic.questionCount, language)})
                </option>
              ))}
            </select>
          </label>
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={() => setFilters(EMPTY_ADMISSION_BANK_FILTERS)}
            className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-1.5 text-[11px] font-bold text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            {t('admission.hub.resetFilters')}
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 px-0.5">
        <p className="min-w-0 truncate text-[11px] font-semibold text-text-secondary">
          {t('admission.hub.showingCount', {
            shown: localizeDigits(questions.length, language),
            total: localizeDigits(total, language),
          })}
        </p>

        <button
          type="button"
          disabled={questions.length === 0}
          aria-pressed={revealState.answersRevealed}
          onClick={() => dispatchReveal({ type: 'toggle-answers' })}
          className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50 ${
            revealState.answersRevealed
              ? 'border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-border-color bg-surface text-text-primary'
          }`}
        >
          {revealState.answersRevealed ? (
            <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {revealState.answersRevealed
            ? t('admission.hub.hideAnswers')
            : t('admission.hub.showAnswers')}
        </button>
      </div>

      {bankQuery.isError ? (
        <AdmissionState
          variant="error"
          title={t('admission.errorTitle')}
          message={t('admission.errorMessage')}
          actionLabel={t('admission.retry')}
          onAction={() => bankQuery.refetch()}
        />
      ) : isLoadingFirstPage ? (
        <div className="space-y-2.5" role="status" aria-live="polite">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton
              key={`admission-bank-skeleton-${index}`}
              className="h-40 rounded-2xl bg-surface-elevated"
            />
          ))}
        </div>
      ) : questions.length === 0 ? (
        <AdmissionState
          variant="empty"
          title={t('admission.hub.emptyBank')}
          message={t('admission.hub.emptyBankHint')}
          actionLabel={hasFilters ? t('admission.hub.resetFilters') : undefined}
          onAction={hasFilters ? () => setFilters(EMPTY_ADMISSION_BANK_FILTERS) : undefined}
        />
      ) : (
        <div className="space-y-2.5">
          {questions.map((question) => (
            <QuestionCard
              key={question.id}
              question={question}
              language={language}
              correctOptionIds={answerKeys.get(question.id) ?? null}
              answersRevealed={revealState.answersRevealed}
              isExplanationVisible={isExplanationExpanded(
                question.id,
                revealState
              )}
              isAnswerKeyLoading={answersQuery.isFetching}
              isBookmarkUpdating={isBookmarkUpdating(question.id)}
              onToggleExplanation={(questionId) =>
                dispatchReveal({ type: 'toggle-explanation', questionId })
              }
              onBookmarkToggle={async (questionId, isBookmarked) => {
                await bookmarkMutation.mutateAsync({ questionId, isBookmarked });
              }}
            />
          ))}

          {bankQuery.hasNextPage && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                disabled={bankQuery.isFetchingNextPage}
                onClick={() => void bankQuery.fetchNextPage()}
                className="inline-flex min-h-10 items-center rounded-xl bg-primary px-5 text-xs font-bold text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                {bankQuery.isFetchingNextPage
                  ? t('admission.hub.loadingMore')
                  : t('admission.hub.loadMore')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdmissionBankPanel;
