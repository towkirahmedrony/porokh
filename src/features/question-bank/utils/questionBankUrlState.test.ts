import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyQuestionBankFilterChange,
  buildQuestionBankSearchParams,
  filtersFromSearchParams,
  hasQuestionBankView,
  isQuestionBankListRequest,
  withAdmissionDefaults,
} from './questionBankUrlState';
import {
  DEFAULT_QUESTION_BANK_FILTERS,
  type QuestionBankFilterState,
} from '../types/questionBank';

const parse = (search: string) => new URLSearchParams(search);

test('the base route means the subject list view', () => {
  const filters = filtersFromSearchParams(parse(''));

  assert.deepEqual(filters, DEFAULT_QUESTION_BANK_FILTERS);
  assert.equal(hasQuestionBankView(filters), false);
});

test('the level and the goal track survive a refresh', () => {
  const filters = filtersFromSearchParams(parse('?level=admission&track=engineering'));

  assert.equal(filters.level, 'admission');
  assert.equal(filters.track, 'engineering');
});

test('an unknown level or track falls back to HSC with no track', () => {
  const filters = filtersFromSearchParams(parse('?level=graduate&track=doctorate'));

  assert.equal(filters.level, 'hsc');
  assert.equal(filters.track, '');
});

test('switching level clears the filters the other level cannot honour', () => {
  const switched = applyQuestionBankFilterChange(
    {
      ...DEFAULT_QUESTION_BANK_FILTERS,
      subjectId: 'subject-1',
      chapterId: 'chapter-2',
      universityId: 'university-1',
      admissionUnitId: 'unit-2',
      year: '2024',
      allTracks: true,
    },
    'level',
    'admission'
  );

  assert.equal(switched.level, 'admission');
  assert.equal(switched.subjectId, '');
  assert.equal(switched.chapterId, '');
  assert.equal(switched.universityId, '');
  assert.equal(switched.admissionUnitId, '');
  assert.equal(switched.year, '');
  assert.equal(switched.allTracks, false);
});

test('changing the university drops the unit chosen from the old one', () => {
  const changed = applyQuestionBankFilterChange(
    { ...DEFAULT_QUESTION_BANK_FILTERS, universityId: 'university-1', admissionUnitId: 'unit-2' },
    'universityId',
    'university-9'
  );

  assert.equal(changed.universityId, 'university-9');
  assert.equal(changed.admissionUnitId, '');
});

test('a subject in the URL opens the question list', () => {
  const filters = filtersFromSearchParams(parse('?subject=subject-1'));

  assert.equal(filters.subjectId, 'subject-1');
  assert.equal(hasQuestionBankView(filters), true);
});

test('search and quick filters also count as an open question view', () => {
  assert.equal(hasQuestionBankView(filtersFromSearchParams(parse('?q=math'))), true);
  assert.equal(hasQuestionBankView(filtersFromSearchParams(parse('?bookmarked=1'))), true);
  assert.equal(hasQuestionBankView(filtersFromSearchParams(parse('?mistakes=1'))), true);
  assert.equal(hasQuestionBankView(filtersFromSearchParams(parse('?premium=1'))), true);
});

test('every supported filter round-trips through the URL', () => {
  const source: QuestionBankFilterState = {
    search: 'গণিত',
    subjectId: 'subject-1',
    chapterId: 'chapter-2',
    topicId: 'topic-3',
    institutionType: 'board',
    institutionEiin: '123456',
    year: '2024',
    bookmarkedOnly: true,
    mistakesOnly: true,
    premiumOnly: true,
    sortBy: 'most_attempted',
    level: 'admission',
    track: 'medical',
    allTracks: true,
    universityId: 'university-1',
    admissionUnitId: 'unit-2',
  };

  const restored = filtersFromSearchParams(
    buildQuestionBankSearchParams(source)
  );

  assert.deepEqual(restored, source);
});

test('default values are omitted so subject links stay short', () => {
  const params = buildQuestionBankSearchParams({
    ...DEFAULT_QUESTION_BANK_FILTERS,
    subjectId: 'subject-1',
  });

  assert.equal(params.get('subject'), 'subject-1');
  assert.equal(params.get('year'), null);
  assert.equal(params.get('sort'), null);
});

test('invalid URL values fall back to defaults instead of breaking the view', () => {
  const filters = filtersFromSearchParams(
    parse('?year=not-a-year&source=made-up&sort=random')
  );

  assert.equal(filters.year, '');
  assert.equal(filters.institutionType, '');
  assert.equal(filters.sortBy, 'newest');
});

test('changing subject clears chapter and topic', () => {
  const next = applyQuestionBankFilterChange(
    { ...DEFAULT_QUESTION_BANK_FILTERS, subjectId: 'a', chapterId: 'c', topicId: 't' },
    'subjectId',
    'b'
  );

  assert.equal(next.subjectId, 'b');
  assert.equal(next.chapterId, '');
  assert.equal(next.topicId, '');
});

test('changing chapter clears the topic', () => {
  const next = applyQuestionBankFilterChange(
    { ...DEFAULT_QUESTION_BANK_FILTERS, chapterId: 'c1', topicId: 't1' },
    'chapterId',
    'c2'
  );

  assert.equal(next.chapterId, 'c2');
  assert.equal(next.topicId, '');
});

test('changing source clears the institution', () => {
  const next = applyQuestionBankFilterChange(
    { ...DEFAULT_QUESTION_BANK_FILTERS, institutionType: 'board', institutionEiin: '1' },
    'institutionType',
    'college'
  );

  assert.equal(next.institutionType, 'college');
  assert.equal(next.institutionEiin, '');
});

test('the admission tab loads its list with no scoping filter, HSC does not', () => {
  // The regression: the base admission screen sends no subject, no search and
  // no quick filter, and the list query used to be disabled for that reason, so
  // the bank rendered "0 / 0" and the goal empty state without ever calling the
  // RPC.
  const base = filtersFromSearchParams(parse(''));

  assert.equal(isQuestionBankListRequest(base), false);

  const admission = withAdmissionDefaults(base, 'varsity');

  assert.equal(admission.level, 'admission');
  assert.equal(admission.track, 'varsity');
  assert.equal(isQuestionBankListRequest(admission), true);
});

test('the admission defaults are applied in one step and are idempotent', () => {
  const base = filtersFromSearchParams(parse(''));
  const once = withAdmissionDefaults(base, 'varsity');

  // Same object back means the page has nothing to write to the URL, so the
  // level and the track cost exactly one navigation and one request.
  assert.equal(withAdmissionDefaults(once, 'varsity'), once);

  // A copied HSC link is moved to admission and the HSC subject is dropped.
  const stale = filtersFromSearchParams(parse('?level=hsc&subject=subject-1'));
  const fixed = withAdmissionDefaults(stale, 'medical');

  assert.equal(fixed.level, 'admission');
  assert.equal(fixed.track, 'medical');
  assert.equal(fixed.subjectId, '');
});

test('a goal-less admission student loads the list with every track', () => {
  const base = filtersFromSearchParams(parse(''));
  const admission = withAdmissionDefaults(base, null);

  assert.equal(admission.level, 'admission');
  assert.equal(admission.track, '');
  assert.equal(isQuestionBankListRequest(admission), true);
});
