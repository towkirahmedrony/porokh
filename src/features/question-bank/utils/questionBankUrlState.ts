import {
  DEFAULT_QUESTION_BANK_FILTERS,
  type QuestionBankFilterState,
  type QuestionBankTrack,
} from '../types/questionBank';

const INSTITUTION_TYPES = ['board', 'college', 'admission'] as const;
const LEVELS = ['hsc', 'admission'] as const;
const TRACKS = ['varsity', 'medical', 'engineering'] as const;
const SORT_VALUES: QuestionBankFilterState['sortBy'][] = [
  'newest',
  'oldest',
  'most_attempted',
  'least_attempted',
];

const readParam = (params: URLSearchParams, key: string): string =>
  params.get(key)?.trim() ?? '';

const isFlagOn = (params: URLSearchParams, key: string): boolean =>
  params.get(key) === '1';

/**
 * The subject list and the question list are two views of the same route. A
 * view is "open" as soon as the URL carries something that scopes the list;
 * otherwise the base route means the subject picker.
 */
export function hasQuestionBankView(filters: QuestionBankFilterState): boolean {
  return Boolean(
    filters.subjectId ||
      filters.search ||
      filters.bookmarkedOnly ||
      filters.mistakesOnly ||
      filters.premiumOnly
  );
}

/**
 * Whether the route should request the question list at all.
 *
 * HSC browsing opens on the subject picker, so the list exists only once
 * something scopes it. Admission browsing opens on the list itself: the goal,
 * the university and the track are the way in, and no subject is ever chosen,
 * so `hasQuestionBankView` must not gate it. Without this distinction the base
 * admission screen requested nothing and rendered the goal empty state from a
 * query that never ran.
 *
 * The level in the URL decides, not the stage: the page rewrites a stale level
 * from the server's stage before the list renders.
 */
export function isQuestionBankListRequest(
  filters: QuestionBankFilterState
): boolean {
  return filters.level === 'admission' || hasQuestionBankView(filters);
}

/**
 * The admission tab's defaults, applied in one step.
 *
 * The level and the goal track are tab state, not filters. Writing them
 * separately costs two navigations and two requests, and the first one renders
 * every admission track before the goal one arrives. Returns the same object
 * when nothing changes, so the caller can skip the write entirely.
 */
export function withAdmissionDefaults(
  filters: QuestionBankFilterState,
  defaultTrack: QuestionBankTrack | null
): QuestionBankFilterState {
  let next = filters;

  if (next.level !== 'admission') {
    next = applyQuestionBankFilterChange(next, 'level', 'admission');
  }

  if (next.track === '' && defaultTrack) {
    next = applyQuestionBankFilterChange(next, 'track', defaultTrack);
  }

  return next;
}

export function filtersFromSearchParams(
  params: URLSearchParams
): QuestionBankFilterState {
  const institutionType = readParam(params, 'source');
  const year = readParam(params, 'year');
  const sortBy = readParam(params, 'sort');

  return {
    ...DEFAULT_QUESTION_BANK_FILTERS,
    search: readParam(params, 'q'),
    subjectId: readParam(params, 'subject'),
    chapterId: readParam(params, 'chapter'),
    topicId: readParam(params, 'topic'),
    institutionType: (INSTITUTION_TYPES as readonly string[]).includes(
      institutionType
    )
      ? institutionType
      : '',
    institutionEiin: readParam(params, 'institution'),
    year: /^\d{4}$/.test(year) ? year : '',
    bookmarkedOnly: isFlagOn(params, 'bookmarked'),
    mistakesOnly: isFlagOn(params, 'mistakes'),
    premiumOnly: isFlagOn(params, 'premium'),
    sortBy: SORT_VALUES.includes(sortBy as QuestionBankFilterState['sortBy'])
      ? (sortBy as QuestionBankFilterState['sortBy'])
      : DEFAULT_QUESTION_BANK_FILTERS.sortBy,
    level: (LEVELS as readonly string[]).includes(readParam(params, 'level'))
      ? (readParam(params, 'level') as QuestionBankFilterState['level'])
      : DEFAULT_QUESTION_BANK_FILTERS.level,
    track: (TRACKS as readonly string[]).includes(readParam(params, 'track'))
      ? (readParam(params, 'track') as QuestionBankFilterState['track'])
      : '',
    allTracks: isFlagOn(params, 'allTracks'),
    universityId: readParam(params, 'university'),
    admissionUnitId: readParam(params, 'unit'),
  };
}

export function buildQuestionBankSearchParams(
  filters: QuestionBankFilterState
): URLSearchParams {
  const params = new URLSearchParams();
  const setValue = (key: string, value: string) => {
    if (value) params.set(key, value);
  };

  setValue('subject', filters.subjectId);
  setValue('q', filters.search);
  setValue('chapter', filters.chapterId);
  setValue('topic', filters.topicId);
  setValue('source', filters.institutionType);
  setValue('institution', filters.institutionEiin);
  setValue('year', filters.year);

  setValue('university', filters.universityId);
  setValue('unit', filters.admissionUnitId);
  if (filters.level !== DEFAULT_QUESTION_BANK_FILTERS.level) {
    params.set('level', filters.level);
  }
  setValue('track', filters.track);

  if (filters.bookmarkedOnly) params.set('bookmarked', '1');
  if (filters.mistakesOnly) params.set('mistakes', '1');
  if (filters.premiumOnly) params.set('premium', '1');
  if (filters.allTracks) params.set('allTracks', '1');
  if (filters.sortBy !== DEFAULT_QUESTION_BANK_FILTERS.sortBy) {
    params.set('sort', filters.sortBy);
  }

  return params;
}

/**
 * Pure version of the hook's filter update rules: changing the subject clears
 * chapter/topic, and changing the chapter clears the topic.
 */
export function applyQuestionBankFilterChange<K extends keyof QuestionBankFilterState>(
  filters: QuestionBankFilterState,
  key: K,
  value: QuestionBankFilterState[K]
): QuestionBankFilterState {
  if (key === 'subjectId') {
    return {
      ...filters,
      subjectId: String(value),
      chapterId: '',
      topicId: '',
    };
  }

  if (key === 'chapterId') {
    return {
      ...filters,
      chapterId: String(value),
      topicId: '',
    };
  }

  if (key === 'institutionType') {
    return {
      ...filters,
      institutionType: String(value),
      institutionEiin: '',
    };
  }

  if (key === 'universityId') {
    // A unit belongs to one university, so changing the university drops it.
    return {
      ...filters,
      universityId: String(value),
      admissionUnitId: '',
    };
  }

  if (key === 'level') {
    // The two tabs have different filters; carrying them across would show a
    // count the other tab cannot honour.
    return {
      ...filters,
      level: value as QuestionBankFilterState['level'],
      subjectId: '',
      chapterId: '',
      topicId: '',
      universityId: '',
      admissionUnitId: '',
      year: '',
      track: '',
      allTracks: false,
    };
  }

  return {
    ...filters,
    [key]: value,
  };
}
