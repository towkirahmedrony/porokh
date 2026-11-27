import {
  DEFAULT_QUESTION_BANK_FILTERS,
  type QuestionBankFilterState,
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
