import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  fetchQuestionAnswers,
  fetchQuestionPage,
  getQuestionBankFilters,
  toggleBookmark,
} from '../services/questionBankService';
import {
  dedupeQuestions,
  buildStats,
} from '../services/questionBankMapper';
import type { QuestionBankFilterState } from '../types/questionBank';
import {
  applyQuestionBankFilterChange,
  buildQuestionBankSearchParams,
  filtersFromSearchParams,
  hasQuestionBankView,
} from '../utils/questionBankUrlState';
import {
  questionBankSessionKey,
  readQuestionBankSession,
  writeQuestionBankSession,
} from '../utils/questionBankSession';

/** Delay before a typed search term is sent to the database. */
export const SEARCH_DEBOUNCE_MS = 350;

const emptyStats = {
  total: 0,
  bookmarked: 0,
  mistakes: 0,
  mcq: 0,
  board: 0,
  premium: 0,
} as const;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

const toQuestionBankSearch = (filters: QuestionBankFilterState): string => {
  const search = buildQuestionBankSearchParams(filters).toString();
  return search ? `?${search}` : '';
};

export function useQuestionBank() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  /**
   * The URL is the source of truth for the open view and its filters, so a
   * refresh and a shared link always land on the same question list.
   */
  const filters = useMemo(
    () => filtersFromSearchParams(searchParams),
    [searchParams]
  );

  const sessionKey = questionBankSessionKey(location.pathname, location.search);
  const storedSession = useMemo(
    () => readQuestionBankSession(sessionKey),
    [sessionKey]
  );
  const targetPageCount = Math.max(1, storedSession?.pageCount ?? 1);

  const filtersQuery = useQuery({
    queryKey: ['question-bank', 'filters'],
    queryFn: getQuestionBankFilters,
    staleTime: 1000 * 60 * 10,
  });

  /**
   * Only the search term is debounced. Dropdown/toggle filters should feel
   * instant, but every keystroke used to trigger a full RPC round-trip.
   */
  const debouncedSearch = useDebouncedValue(filters.search, SEARCH_DEBOUNCE_MS);

  const effectiveFilters = useMemo<QuestionBankFilterState>(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch]
  );

  const hasView = hasQuestionBankView(filters);
  const isFiltersLoaded = Boolean(filtersQuery.data);
  const isInvalidSubject =
    isFiltersLoaded &&
    Boolean(filters.subjectId) &&
    !filtersQuery.data?.subjects.some(
      (subject) => subject.id === filters.subjectId
    );

  // An unknown subject in a copied URL must not trigger a doomed request.
  const shouldFetchQuestions = hasView && !isInvalidSubject;

  const questionsQuery = useInfiniteQuery({
    queryKey: ['question-bank', 'questions', effectiveFilters],
    queryFn: ({ pageParam }) => fetchQuestionPage(effectiveFilters, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    // Keeps the previous page on screen while a new filter loads instead of
    // flashing the full-page loader on every change.
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 2,
    enabled: shouldFetchQuestions,
  });

  const loadedPageCount = questionsQuery.data?.pages.length ?? 0;

  // Restore the "load more" depth recorded for this exact URL. Pages are
  // fetched sequentially after the first one resolves, so the first paint still
  // happens immediately.
  useEffect(() => {
    if (!shouldFetchQuestions) return;
    if (loadedPageCount < 1 || loadedPageCount >= targetPageCount) return;
    if (!questionsQuery.hasNextPage) return;
    if (questionsQuery.isFetching || questionsQuery.isFetchingNextPage) return;
    // A failed page must not be retried in a tight loop.
    if (questionsQuery.isFetchNextPageError) return;

    void questionsQuery.fetchNextPage();
  }, [
    shouldFetchQuestions,
    loadedPageCount,
    targetPageCount,
    questionsQuery.hasNextPage,
    questionsQuery.isFetching,
    questionsQuery.isFetchingNextPage,
    questionsQuery.isFetchNextPageError,
    questionsQuery.fetchNextPage,
  ]);

  useEffect(() => {
    if (!shouldFetchQuestions || loadedPageCount < 1) return;
    writeQuestionBankSession(sessionKey, { pageCount: loadedPageCount });
  }, [shouldFetchQuestions, loadedPageCount, sessionKey]);

  const toggleBookmarkMutation = useMutation({
    mutationFn: ({ questionId, isBookmarked }: { questionId: string; isBookmarked: boolean }) =>
      toggleBookmark(questionId, isBookmarked),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['question-bank', 'questions'] }),
        queryClient.invalidateQueries({ queryKey: ['history', 'bookmarks'] }),
        queryClient.invalidateQueries({ queryKey: ['exams', 'bookmarks'] }),
      ]);
    },
  });

  const derived = useMemo(() => {
    const subjects = filtersQuery.data?.subjects ?? [];
    const chapters = filtersQuery.data?.chapters ?? [];
    const topics = filtersQuery.data?.topics ?? [];
    const boards = filtersQuery.data?.boards ?? [];
    const colleges = filtersQuery.data?.colleges ?? [];
    const admissions = filtersQuery.data?.admissions ?? [];

    const filteredChapters = filters.subjectId
      ? chapters.filter((item) => item.subject_id === filters.subjectId)
      : chapters;

    const validChapterIds = new Set(filteredChapters.map((c) => c.id));
    const filteredTopics = topics.filter((topic) => {
      if (filters.chapterId) {
        return topic.chapter_id === filters.chapterId;
      }
      if (filters.subjectId) {
        return topic.chapter_id && validChapterIds.has(topic.chapter_id);
      }
      return true;
    });

    const pages = questionsQuery.data?.pages ?? [];
    const questions = dedupeQuestions(pages.flatMap((page) => page.questions));

    return {
      subjects,
      chapters: filteredChapters,
      topics: filteredTopics,
      boards,
      colleges,
      admissions,
      questions,
      // Loaded-row stats; the header reports the authoritative total separately.
      stats: questions.length > 0 ? buildStats(questions) : emptyStats,
      total: pages[0]?.total ?? 0,
      mode: pages[0]?.mode ?? null,
      capped: pages[0]?.capped ?? false,
    };
  }, [filters, filtersQuery.data, questionsQuery.data]);

  const answerQuestionIds = useMemo(
    () =>
      derived.questions
        .filter((question) => !question.isLocked)
        .map((question) => question.id),
    [derived.questions]
  );

  const answersQuery = useQuery({
    queryKey: ['question-bank', 'answers', answerQuestionIds],
    queryFn: () => fetchQuestionAnswers(answerQuestionIds),
    enabled: answerQuestionIds.length > 0,
    staleTime: 1000 * 60 * 10,
    placeholderData: keepPreviousData,
  });

  const answerKeys = useMemo(
    () =>
      new Map(
        (answersQuery.data ?? []).map((answer) => [
          answer.questionId,
          answer.correctOptionIds,
        ])
      ),
    [answersQuery.data]
  );

  const updateFilter = useCallback(
    <K extends keyof QuestionBankFilterState>(
      key: K,
      value: QuestionBankFilterState[K]
    ) => {
      const next = applyQuestionBankFilterChange(filters, key, value);
      navigate(
        {
          pathname: location.pathname,
          search: toQuestionBankSearch(next),
        },
        // Filter tweaks replace the current entry so Back never walks through
        // every keystroke or dropdown change. Keeping the location state lets
        // the in-app Back button still recognise the subject list behind it.
        { replace: true, state: location.state }
      );
    },
    [filters, location.pathname, location.state, navigate]
  );

  const resetFilters = useCallback(() => {
    navigate(
      { pathname: location.pathname, search: '' },
      { replace: true, state: location.state }
    );
  }, [location.pathname, location.state, navigate]);

  /**
   * Opening a subject is a navigation, not a filter tweak: it must create a
   * history entry so both the in-app and browser Back buttons return here.
   */
  const openSubject = useCallback(
    (subjectId: string) => {
      const next = applyQuestionBankFilterChange(filters, 'subjectId', subjectId);
      navigate(
        {
          pathname: location.pathname,
          search: toQuestionBankSearch(next),
        },
        { state: { fromQuestionBankSubjects: true } }
      );
    },
    [filters, location.pathname, navigate]
  );

  const loadMore = () => {
    if (!questionsQuery.hasNextPage || questionsQuery.isFetchingNextPage) return;
    void questionsQuery.fetchNextPage();
  };

  return {
    filters,
    updateFilter,
    resetFilters,
    openSubject,
    hasView,
    isInvalidSubject,
    sessionKey,
    isPaginationRestored:
      !shouldFetchQuestions ||
      loadedPageCount >= targetPageCount ||
      !questionsQuery.hasNextPage ||
      questionsQuery.isFetchNextPageError,
    subjects: derived.subjects,
    chapters: derived.chapters,
    topics: derived.topics,
    boards: derived.boards,
    colleges: derived.colleges,
    admissions: derived.admissions,
    questions: derived.questions,
    stats: derived.stats,
    total: derived.total,
    mode: derived.mode,
    capped: derived.capped,
    isLoading: filtersQuery.isLoading || (shouldFetchQuestions && questionsQuery.isLoading),
    isFetching: questionsQuery.isFetching,
    isFetchingNextPage: questionsQuery.isFetchingNextPage,
    hasMore: Boolean(questionsQuery.hasNextPage),
    loadMore,
    error: filtersQuery.error || questionsQuery.error,
    refetch: questionsQuery.refetch,
    toggleBookmark: toggleBookmarkMutation.mutateAsync,
    bookmarkUpdatingId: toggleBookmarkMutation.isPending
      ? toggleBookmarkMutation.variables?.questionId ?? null
      : null,
    isBookmarkUpdating: toggleBookmarkMutation.isPending,
    answerKeys,
    isAnswersLoading: answersQuery.isLoading,
    isAnswersFetching: answersQuery.isFetching,
    answersError: answersQuery.error,
  };
}
