import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyClientSideFilters,
  applySearch,
  buildStats,
  dedupeQuestions,
  getExamBadge,
  getExplanationText,
  getOptionText,
  getQuestionText,
  getSubjectName,
  localizedText,
  mapAnswerKey,
  mapQuestion,
  resolvePagination,
  sortQuestions,
} from './questionBankMapper';
import { describeQuestionBankError, isMissingRpcError } from './questionBankErrors';
import {
  DEFAULT_QUESTION_BANK_FILTERS,
  type QuestionBankFilterState,
  type QuestionBankQuestion,
  type QuestionBankRpcRow,
} from '../types/questionBank';

const row = (overrides: Partial<QuestionBankRpcRow> = {}): QuestionBankRpcRow => ({
  id: 'q1',
  type: 'MCQ',
  difficulty_level: 'easy',
  source_type: 'board_exam',
  tags: ['2023'],
  exam_references: [{ eiin: '123', year: '2023' }],
  subject_id: 's1',
  chapter_id: 'c1',
  topic_id: 't1',
  total_attempts: 10,
  correct_attempts: 4,
  created_at: '2026-01-02T00:00:00.000Z',
  body: { text_bn: 'প্রশ্ন', text_en: 'Question' },
  options: [
    { id: 'o1', text_bn: 'ক', text_en: 'A' },
    { id: 'o2', text_bn: 'খ', text_en: 'B' },
  ],
  explanation: 'ব্যাখ্যা',
  subjects: { name_bn: 'গণিত', name_en: 'Math', is_premium: false },
  chapters: { name_bn: 'বীজগণিত', name_en: 'Algebra', is_premium: false },
  topics: { name_bn: 'সমীকরণ', name_en: 'Equations', is_premium: false },
  ...overrides,
});

const emptyMeta = { bookmarkedIds: new Set<string>(), wrongIds: new Set<string>() };
const filters = (overrides: Partial<QuestionBankFilterState> = {}): QuestionBankFilterState => ({
  ...DEFAULT_QUESTION_BANK_FILTERS,
  ...overrides,
});

test('rows are mapped into the UI model with all fields in place', () => {
  const question = mapQuestion(row(), { bookmarkedIds: new Set(['q1']), wrongIds: new Set() });

  assert.equal(question.id, 'q1');
  assert.equal(question.type, 'MCQ');
  assert.equal(question.body.text_bn, 'প্রশ্ন');
  assert.equal(question.options.length, 2);
  assert.equal(question.subjectNameBn, 'গণিত');
  assert.equal(question.chapterNameEn, 'Algebra');
  assert.equal(question.isBookmarked, true);
  assert.equal(question.isWrongAnswered, false);
  assert.equal(question.isLocked, false);
  assert.equal(question.totalAttempts, 10);
});

test('option order is preserved exactly as stored', () => {
  const question = mapQuestion(
    row({ options: [{ id: 'b', text_en: 'B' }, { id: 'a', text_en: 'A' }] }),
    emptyMeta
  );

  assert.deepEqual(
    question.options.map((option) => option.id),
    ['b', 'a']
  );
});

test('object explanations are localized and legacy strings still render', () => {
  const localized = mapQuestion(
    row({ explanation: { bn: 'বাংলা ব্যাখ্যা', en: 'English explanation' } }),
    emptyMeta
  );

  assert.equal(getExplanationText(localized, 'bn'), 'বাংলা ব্যাখ্যা');
  assert.equal(getExplanationText(localized, 'en'), 'English explanation');

  const banglaOnly = mapQuestion(row({ explanation: { bn: 'শুধু বাংলা' } }), emptyMeta);
  assert.equal(getExplanationText(banglaOnly, 'en'), 'শুধু বাংলা', 'falls back to Bangla');

  const legacyString = mapQuestion(row({ explanation: 'পুরনো ব্যাখ্যা' }), emptyMeta);
  assert.equal(getExplanationText(legacyString, 'en'), 'পুরনো ব্যাখ্যা');

  assert.equal(mapQuestion(row({ explanation: {} }), emptyMeta).explanation, null);
  assert.equal(mapQuestion(row({ explanation: null }), emptyMeta).explanation, null);
});

test('answer-key rows expose only the question id and option ids', () => {
  assert.deepEqual(
    mapAnswerKey({
      id: 'q1',
      correct_option_ids: [1, 4, 'o5', 4, null, true],
      explanation: 'must not leak',
      body: { text_bn: 'must not leak' },
    }),
    { questionId: 'q1', correctOptionIds: ['1', '4', 'o5'] }
  );
  assert.deepEqual(mapAnswerKey({ id: 'q1', correct_option_ids: '4' }), {
    questionId: 'q1',
    correctOptionIds: [],
  });
  assert.equal(mapAnswerKey({ correct_option_ids: [1] }), null);
  assert.equal(mapAnswerKey({ id: '  ' }), null);
  assert.equal(mapAnswerKey(null), null);
});

test('exam badges localize known boards and ignore internal tag slugs', () => {
  const board = mapQuestion(
    row({
      exam_references: [{ board: 'Dinajpur Board', year: '2017', source_kind: 'board' }],
      tags: ['dinajpur_board_2017'],
    }),
    emptyMeta
  );

  assert.deepEqual(getExamBadge(board, 'bn'), { label: 'দিনাজপুর বোর্ড', year: '2017' });
  assert.deepEqual(getExamBadge(board, 'en'), { label: 'Dinajpur Board', year: '2017' });

  const chattogram = mapQuestion(
    row({ exam_references: [{ board: 'Chattogram Board', year: '2024' }] }),
    emptyMeta
  );
  assert.deepEqual(getExamBadge(chattogram, 'bn'), {
    label: 'চট্টগ্রাম বোর্ড',
    year: '2024',
  });

  const tagOnly = mapQuestion(
    row({ exam_references: [], tags: ['sylhet_board_2017'] }),
    emptyMeta
  );
  assert.deepEqual(getExamBadge(tagOnly, 'bn'), { label: 'সিলেট বোর্ড', year: '2017' });

  const college = mapQuestion(
    row({
      source_type: 'college_test',
      exam_references: [
        { institution_name: 'Cumilla Cadet College', year: '2026', source_kind: 'college' },
      ],
      tags: ['cumilla_cadet_college_2026'],
    }),
    emptyMeta
  );
  assert.deepEqual(getExamBadge(college, 'bn'), {
    label: 'Cumilla Cadet College',
    year: '2026',
  });

  const internalOnly = mapQuestion(
    row({ exam_references: [], tags: ['some_internal_slug'] }),
    emptyMeta
  );
  assert.equal(getExamBadge(internalOnly, 'bn'), null);
});

test('answer-key fields from the database are never surfaced', () => {
  const question = mapQuestion(
    row({
      options: [
        { id: 'o1', text_bn: 'ক', is_correct: true },
        { id: 'o2', text_bn: 'খ', is_correct: false },
      ],
    }),
    emptyMeta
  );

  assert.equal(JSON.stringify(question).includes('is_correct'), false);
  assert.equal(JSON.stringify(question).includes('isCorrect'), false);
});

test('a redacted premium row is reported as locked, not as broken content', () => {
  const locked = mapQuestion(
    row({
      body: {},
      options: [],
      explanation: null,
      subjects: { name_bn: 'প্রিমিয়াম', name_en: 'Premium', is_premium: true },
    }),
    emptyMeta
  );

  assert.equal(locked.isLocked, true);
  assert.equal(locked.isPremium, true);

  const premiumWithContent = mapQuestion(
    row({ subjects: { name_bn: 'প্রিমিয়াম', is_premium: true } }),
    emptyMeta
  );
  assert.equal(premiumWithContent.isLocked, false, 'a premium user receives readable content');
});

test('missing optional fields do not break the mapping', () => {
  const question = mapQuestion(
    row({
      type: null,
      difficulty_level: null,
      source_type: null,
      tags: null,
      exam_references: null,
      subjects: null,
      chapters: null,
      topics: null,
      body: null,
      options: null,
      explanation: null,
      total_attempts: null,
      correct_attempts: null,
      created_at: null,
    }),
    emptyMeta
  );

  assert.equal(question.type, 'MCQ');
  assert.equal(question.body.text_bn, undefined);
  assert.deepEqual(question.options, []);
  assert.deepEqual(question.tags, []);
  assert.deepEqual(question.examReferences, []);
  assert.equal(question.totalAttempts, 0);
  assert.equal(question.subjectNameBn, null);
});

test('question and option text follow the active interface language', () => {
  const question = mapQuestion(row(), emptyMeta);

  assert.equal(getQuestionText(question, 'bn'), 'প্রশ্ন');
  assert.equal(getQuestionText(question, 'en'), 'Question');
  assert.equal(getOptionText(question.options[0], 'en'), 'A');
  assert.equal(getSubjectName(question, 'en'), 'Math');

  const banglaOnly = mapQuestion(row({ body: { text_bn: 'শুধু বাংলা' } }), emptyMeta);
  assert.equal(getQuestionText(banglaOnly, 'en'), 'শুধু বাংলা', 'falls back to the original text');

  const englishOnly = mapQuestion(row({ body: { text_en: 'English only' } }), emptyMeta);
  assert.equal(getQuestionText(englishOnly, 'bn'), 'English only');
  assert.equal(localizedText(undefined, '  ', 'en'), '');
});

test('search matches question text, options, tags and subject names', () => {
  const list = [
    mapQuestion(row({ id: 'a', body: { text_bn: 'নিউটনের সূত্র' } }), emptyMeta),
    mapQuestion(row({ id: 'b', body: { text_en: 'Photosynthesis' } }), emptyMeta),
    mapQuestion(row({ id: 'c', tags: ['2021'] }), emptyMeta),
    mapQuestion(
      row({ id: 'd', explanation: { bn: 'ত্বরণ', en: 'acceleration' } }),
      emptyMeta
    ),
  ];

  assert.deepEqual(applySearch(list, 'নিউটন').map((q) => q.id), ['a']);
  assert.deepEqual(applySearch(list, 'photosyn').map((q) => q.id), ['b']);
  assert.deepEqual(applySearch(list, '2021').map((q) => q.id), ['c']);
  assert.deepEqual(applySearch(list, 'acceleration').map((q) => q.id), ['d']);
  assert.deepEqual(applySearch(list, 'ত্বরণ').map((q) => q.id), ['d']);
  assert.equal(applySearch(list, '   ').length, list.length, 'blank search is a no-op');
  assert.equal(applySearch(list, 'zzz').length, 0);
});

test('bookmark, mistake, premium, year and institution filters work', () => {
  const bookmarked = mapQuestion(row({ id: 'b' }), {
    bookmarkedIds: new Set(['b']),
    wrongIds: new Set(),
  });
  const wrong = mapQuestion(row({ id: 'w' }), {
    bookmarkedIds: new Set(),
    wrongIds: new Set(['w']),
  });
  const premium = mapQuestion(row({ id: 'p', subjects: { is_premium: true } }), emptyMeta);
  const other = mapQuestion(row({ id: 'o', tags: ['2019'], exam_references: [] }), emptyMeta);
  const list = [bookmarked, wrong, premium, other];

  assert.deepEqual(
    applyClientSideFilters(list, filters({ bookmarkedOnly: true })).map((q) => q.id),
    ['b']
  );
  assert.deepEqual(
    applyClientSideFilters(list, filters({ mistakesOnly: true })).map((q) => q.id),
    ['w']
  );
  assert.deepEqual(
    applyClientSideFilters(list, filters({ premiumOnly: true })).map((q) => q.id),
    ['p']
  );
  assert.ok(applyClientSideFilters(list, filters({ year: '2023' })).every((q) => q.id !== 'o'));
  assert.deepEqual(
    applyClientSideFilters(list, filters({ institutionEiin: '123' })).map((q) => q.id),
    ['b', 'p', 'w']
  );
  assert.deepEqual(applyClientSideFilters(list, filters({ institutionEiin: 'nope' })), []);
});

test('source type filter maps UI kinds to the stored source_type values', () => {
  const board = mapQuestion(row({ id: 'b', source_type: 'board_exam' }), emptyMeta);
  const college = mapQuestion(row({ id: 'c', source_type: 'college_test' }), emptyMeta);
  const admission = mapQuestion(row({ id: 'a', source_type: 'admission' }), emptyMeta);
  const textbook = mapQuestion(row({ id: 't', source_type: 'textbook' }), emptyMeta);
  const list = [board, college, admission, textbook];

  assert.deepEqual(
    applyClientSideFilters(list, filters({ institutionType: 'board' })).map((q) => q.id),
    ['b']
  );
  assert.deepEqual(
    applyClientSideFilters(list, filters({ institutionType: 'college' })).map((q) => q.id),
    ['c']
  );
  assert.deepEqual(
    applyClientSideFilters(list, filters({ institutionType: 'admission' })).map((q) => q.id),
    ['a']
  );
  assert.deepEqual(
    applyClientSideFilters(list, filters({ institutionType: 'textbook' })).map((q) => q.id),
    ['t']
  );
});

test('institution filter matches both EIIN and canonical institution code', () => {
  const byEiin = mapQuestion(
    row({ id: 'e', exam_references: [{ eiin: '123' }] }),
    emptyMeta
  );
  const byCode = mapQuestion(
    row({ id: 'c', exam_references: [{ code: 'BOARD_DHAKA' }] }),
    emptyMeta
  );
  const unrelated = mapQuestion(
    row({ id: 'u', exam_references: [{ eiin: '999' }] }),
    emptyMeta
  );

  assert.deepEqual(
    applyClientSideFilters(
      [byEiin, byCode, unrelated],
      filters({ institutionEiin: '123' })
    ).map((q) => q.id),
    ['e']
  );
  assert.deepEqual(
    applyClientSideFilters(
      [byEiin, byCode, unrelated],
      filters({ institutionEiin: 'BOARD_DHAKA' })
    ).map((q) => q.id),
    ['c']
  );
});

test('sorting is deterministic for equal keys', () => {
  const a = mapQuestion(row({ id: 'a', total_attempts: 5, created_at: '2026-01-01T00:00:00Z' }), emptyMeta);
  const b = mapQuestion(row({ id: 'b', total_attempts: 5, created_at: '2026-01-01T00:00:00Z' }), emptyMeta);

  const first = sortQuestions([a, b], 'most_attempted').map((q) => q.id);
  const second = sortQuestions([b, a], 'most_attempted').map((q) => q.id);

  assert.deepEqual(first, second);
  assert.deepEqual(first, ['a', 'b']);
});

test('stats are derived from the loaded rows', () => {
  const list = [
    mapQuestion(row({ id: '1' }), { bookmarkedIds: new Set(['1']), wrongIds: new Set() }),
    mapQuestion(row({ id: '2', source_type: 'board_exam' }), emptyMeta),
    mapQuestion(
      row({ id: '3', type: 'CQ', source_type: 'model_test', subjects: { is_premium: true } }),
      emptyMeta
    ),
  ];
  const stats = buildStats(list);

  assert.equal(stats.total, 3);
  assert.equal(stats.bookmarked, 1);
  assert.equal(stats.board, 2);
  assert.equal(stats.mcq, 2);
  assert.equal(stats.premium, 1);
});

test('duplicate rows from overlapping page boundaries are collapsed', () => {
  const question: QuestionBankQuestion = mapQuestion(row(), emptyMeta);
  const deduped = dedupeQuestions([question, question, { ...question, id: 'q2' }]);

  assert.deepEqual(deduped.map((q) => q.id), ['q1', 'q2']);
});

test('an empty result set produces zeroed stats', () => {
  const stats = buildStats([]);

  assert.deepEqual(stats, { total: 0, bookmarked: 0, mistakes: 0, mcq: 0, board: 0, premium: 0 });
});

test('RPC absence is detected so the legacy path can take over', () => {
  assert.equal(isMissingRpcError({ code: 'PGRST202', message: 'Could not find the function' }), true);
  assert.equal(isMissingRpcError({ code: '42883' }), true);
  assert.equal(isMissingRpcError({ message: 'function public.x does not exist' }), true);
  assert.equal(isMissingRpcError({ code: '42501', message: 'permission denied' }), false);
  assert.equal(isMissingRpcError(null), false);
});

test('errors are mapped to safe user-facing messages', () => {
  assert.equal(describeQuestionBankError({ code: '42501', message: 'permission denied for function' }), 'questionBank.authRequired');
  assert.equal(describeQuestionBankError({ code: 'AUTH_REQUIRED' }), 'questionBank.authRequired');
  assert.equal(describeQuestionBankError({ status: 429, message: 'Too many requests' }), 'questionBank.rateLimited');
  assert.equal(describeQuestionBankError(new TypeError('Failed to fetch')), 'questionBank.networkError');
  assert.equal(
    describeQuestionBankError({ message: 'relation "public.questions" does not exist' }),
    'questionBank.loadError'
  );
  assert.equal(describeQuestionBankError(null), 'questionBank.loadError');
});

test('pagination exposes a next offset only while rows remain', () => {
  assert.deepEqual(
    resolvePagination({ offset: 0, limit: 20, received: 20, total: 57 }),
    { total: 57, nextOffset: 20 }
  );
  assert.deepEqual(
    resolvePagination({ offset: 40, limit: 20, received: 17, total: 57 }),
    { total: 57, nextOffset: null },
    'a partial page is the last page'
  );
  assert.deepEqual(
    resolvePagination({ offset: 0, limit: 20, received: 5, total: 5 }),
    { total: 5, nextOffset: null }
  );
  assert.deepEqual(
    resolvePagination({ offset: 0, limit: 20, received: 0, total: 0 }),
    { total: 0, nextOffset: null },
    'an empty result must not request another page'
  );
  assert.deepEqual(
    resolvePagination({ offset: 20, limit: 20, received: 20, total: 40 }),
    { total: 40, nextOffset: null },
    'the exact final page stops paging'
  );
});

test('a missing server count falls back to what was received', () => {
  assert.deepEqual(
    resolvePagination({ offset: 0, limit: 20, received: 12, total: 0 }),
    { total: 12, nextOffset: null }
  );
});
