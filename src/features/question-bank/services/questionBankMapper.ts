import type {
  QuestionAnswerKey,
  QuestionBankFilterState,
  QuestionBankQuestion,
  QuestionBankRpcRow,
  QuestionBankStats,
  QuestionBody,
  QuestionExamReference,
  QuestionExplanation,
  QuestionOption,
} from '../types/questionBank';
import {
  isQuestionBody,
  isQuestionOptions,
} from '../types/questionBank';

/**
 * Pure mapping/filtering helpers for the question bank.
 *
 * Kept out of the network service so the rules that decide what a student sees
 * (which text, which option, which rows survive a filter) can be unit tested
 * without a browser or a database.
 */

export type QuestionLanguage = 'bn' | 'en';

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asStringOrNull = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

const asNumberOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const asTrimmedString = (value: unknown): string | null => {
  const text = asStringOrNull(value)?.trim();
  return text ? text : null;
};

const pickExamReferences = (value: unknown): QuestionExamReference[] =>
  asArray(value).reduce<QuestionExamReference[]>((acc, raw) => {
    const record = asRecord(raw);
    if (record) acc.push(record as QuestionExamReference);
    return acc;
  }, []);

export const isRpcRow = (value: unknown): value is QuestionBankRpcRow => {
  const row = asRecord(value);
  return Boolean(row) && typeof row?.id === 'string';
};

/**
 * Fields a student UI may process. Everything else — an answer key, scoring
 * weights, authoring metadata — is dropped here even if the transport carried
 * it, so a wider database response cannot leak into the rendered model.
 */
const BODY_FIELDS = ['text_bn', 'text_en', 'image_url'] as const;

const pickBody = (body: QuestionBody): QuestionBody => {
  const picked: QuestionBody = {};
  for (const field of BODY_FIELDS) {
    const value = body[field];
    if (typeof value === 'string' && value.trim()) picked[field] = value;
  }
  return picked;
};

const pickOptions = (options: unknown[]): QuestionOption[] =>
  options.reduce<QuestionOption[]>((acc, raw) => {
    const option = asRecord(raw);
    if (!option) return acc;

    const id = option.id;
    if (typeof id !== 'string' && typeof id !== 'number') return acc;

    const textBn = asStringOrNull(option.text_bn);
    const textEn = asStringOrNull(option.text_en);
    const imageUrl = asStringOrNull(option.image_url);

    acc.push({
      id,
      ...(textBn ? { text_bn: textBn } : {}),
      ...(textEn ? { text_en: textEn } : {}),
      ...(imageUrl ? { image_url: imageUrl } : {}),
    });
    return acc;
  }, []);

/**
 * Picks the label in the active language and falls back to the other one.
 * Exam content is never translated — an English UI shows the English variant
 * when the question author provided it, otherwise the original Bangla text.
 */
export const localizedText = (
  bn: string | null | undefined,
  en: string | null | undefined,
  language: QuestionLanguage
): string => {
  const bangla = (bn ?? '').trim();
  const english = (en ?? '').trim();

  if (language === 'en') return english || bangla;
  return bangla || english;
};

const BOARD_LABELS: Record<string, { bn: string; en: string }> = {
  dhaka: { bn: 'ঢাকা বোর্ড', en: 'Dhaka Board' },
  rajshahi: { bn: 'রাজশাহী বোর্ড', en: 'Rajshahi Board' },
  dinajpur: { bn: 'দিনাজপুর বোর্ড', en: 'Dinajpur Board' },
  jashore: { bn: 'যশোর বোর্ড', en: 'Jashore Board' },
  khulna: { bn: 'খুলনা বোর্ড', en: 'Khulna Board' },
  barishal: { bn: 'বরিশাল বোর্ড', en: 'Barishal Board' },
  chattogram: { bn: 'চট্টগ্রাম বোর্ড', en: 'Chattogram Board' },
  cumilla: { bn: 'কুমিল্লা বোর্ড', en: 'Cumilla Board' },
  sylhet: { bn: 'সিলেট বোর্ড', en: 'Sylhet Board' },
  mymensingh: { bn: 'ময়মনসিংহ বোর্ড', en: 'Mymensingh Board' },
  madrasah: { bn: 'মাদ্রাসা বোর্ড', en: 'Madrasah Board' },
  technical: { bn: 'কারিগরি শিক্ষা বোর্ড', en: 'Technical Education Board' },
};

const BOARD_ALIASES: Record<string, string> = {
  dhaka: 'dhaka',
  'ঢাকা': 'dhaka',
  rajshahi: 'rajshahi',
  'রাজশাহী': 'rajshahi',
  dinajpur: 'dinajpur',
  'দিনাজপুর': 'dinajpur',
  jashore: 'jashore',
  jessore: 'jashore',
  'যশোর': 'jashore',
  khulna: 'khulna',
  'খুলনা': 'khulna',
  barishal: 'barishal',
  barisal: 'barishal',
  'বরিশাল': 'barishal',
  chattogram: 'chattogram',
  chittagong: 'chattogram',
  'চট্টগ্রাম': 'chattogram',
  cumilla: 'cumilla',
  comilla: 'cumilla',
  'কুমিল্লা': 'cumilla',
  sylhet: 'sylhet',
  'সিলেট': 'sylhet',
  mymensingh: 'mymensingh',
  'ময়মনসিংহ': 'mymensingh',
  'ময়মনসিংহ': 'mymensingh',
  madrasah: 'madrasah',
  'মাদ্রাসা': 'madrasah',
  technical: 'technical',
  bteb: 'technical',
  'কারিগরি': 'technical',
  'কারিগরিশিক্ষা': 'technical',
};

const normalizeBoardKey = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\bboard\b/g, '')
    .replace(/\beducation\b/g, '')
    .replace(/বোর্ড/g, '')
    .replace(/শিক্ষা/g, '')
    .replace(/[^a-z\u0980-\u09ff]/g, '');

const resolveBoardLabel = (
  value: string,
  language: QuestionLanguage
): string | null => {
  const key = BOARD_ALIASES[normalizeBoardKey(value)];
  if (!key) return null;

  const labels = BOARD_LABELS[key];
  return language === 'en' ? labels.en : labels.bn;
};

const isReadableName = (value: string): boolean =>
  /\s/.test(value) || /[\u0980-\u09ff]/.test(value);

const readYear = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return asTrimmedString(value);
};

/**
 * Exam metadata is stored in two generations: structured `exam_references` and
 * legacy tags such as `sylhet_board_2017`. Never render the raw slug; only use
 * a tag when it resolves to a known board, and otherwise fall back to a
 * human-readable structured reference.
 */
export function getExamBadge(
  question: QuestionBankQuestion,
  language: QuestionLanguage
): { label: string; year: string | null } | null {
  for (const reference of question.examReferences) {
    const board = asTrimmedString(reference.board);
    if (board) {
      const label =
        resolveBoardLabel(board, language) ??
        (isReadableName(board) ? board : null);
      if (label) return { label, year: readYear(reference.year) };
    }

    const institution = asTrimmedString(reference.institution_name);
    if (institution) return { label: institution, year: readYear(reference.year) };
  }

  for (const tag of question.tags) {
    const match = /^([a-z][a-z0-9]*)_board_(\d{4})$/i.exec(tag);
    if (!match) continue;

    const label = resolveBoardLabel(match[1], language);
    if (label) return { label, year: match[2] };
  }

  return null;
}

export function parseExplanation(value: unknown): QuestionExplanation | null {
  const record = asRecord(value);
  if (record) {
    const bn = asTrimmedString(record.bn) ?? asTrimmedString(record.text_bn);
    const en = asTrimmedString(record.en) ?? asTrimmedString(record.text_en);
    return bn || en ? { bn, en } : null;
  }

  const text = asTrimmedString(value);
  return text ? { bn: text, en: text } : null;
}

export const getExplanationText = (
  question: QuestionBankQuestion,
  language: QuestionLanguage
): string =>
  question.explanation
    ? localizedText(question.explanation.bn, question.explanation.en, language)
    : '';

export const getQuestionText = (
  question: QuestionBankQuestion,
  language: QuestionLanguage
): string =>
  localizedText(question.body.text_bn, question.body.text_en, language);

export const getOptionText = (
  option: QuestionBankQuestion['options'][number],
  language: QuestionLanguage
): string => localizedText(option.text_bn, option.text_en, language);

export const getSubjectName = (
  question: QuestionBankQuestion,
  language: QuestionLanguage
): string => localizedText(question.subjectNameBn, question.subjectNameEn, language);

export const getChapterName = (
  question: QuestionBankQuestion,
  language: QuestionLanguage
): string => localizedText(question.chapterNameBn, question.chapterNameEn, language);

export const getTopicName = (
  question: QuestionBankQuestion,
  language: QuestionLanguage
): string => localizedText(question.topicNameBn, question.topicNameEn, language);

export function mapAnswerKey(row: unknown): QuestionAnswerKey | null {
  const record = asRecord(row);
  const questionId = asTrimmedString(record?.id);
  if (!questionId) return null;

  const seen = new Set<string>();
  const correctOptionIds: string[] = [];

  for (const value of asArray(record?.correct_option_ids)) {
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    const optionId = String(value).trim();
    if (!optionId || seen.has(optionId)) continue;
    seen.add(optionId);
    correctOptionIds.push(optionId);
  }

  return { questionId, correctOptionIds };
}

export function mapQuestion(
  row: QuestionBankRpcRow,
  meta: { bookmarkedIds: Set<string>; wrongIds: Set<string> }
): QuestionBankQuestion {
  const body = pickBody(isQuestionBody(row.body) ? row.body : {});
  const options = pickOptions(isQuestionOptions(row.options) ? row.options : []);

  const subject = asRecord(row.subjects);
  const chapter = asRecord(row.chapters);
  const topic = asRecord(row.topics);

  const isPremium =
    subject?.is_premium === true ||
    chapter?.is_premium === true ||
    topic?.is_premium === true;

  // The RPC redacts premium rows the caller cannot read: empty body, no options
  // and no explanation. Such a row is a locked question, not a broken one.
  const hasVisibleContent =
    Boolean(body.text_bn || body.text_en || body.image_url) || options.length > 0;

  return {
    id: row.id,
    type: row.type ?? 'MCQ',
    difficultyLevel: row.difficulty_level,
    sourceType: row.source_type,
    explanation: parseExplanation(row.explanation),
    tags: asArray(row.tags).filter((tag): tag is string => typeof tag === 'string'),
    examReferences: pickExamReferences(row.exam_references),
    body,
    options,
    subjectId: row.subject_id,
    subjectNameBn: asStringOrNull(subject?.name_bn),
    subjectNameEn: asStringOrNull(subject?.name_en),
    chapterId: row.chapter_id,
    chapterNameBn: asStringOrNull(chapter?.name_bn),
    chapterNameEn: asStringOrNull(chapter?.name_en),
    topicId: row.topic_id,
    topicNameBn: asStringOrNull(topic?.name_bn),
    topicNameEn: asStringOrNull(topic?.name_en),
    isPremium,
    isLocked: isPremium && !hasVisibleContent,
    isBookmarked: meta.bookmarkedIds.has(row.id),
    isWrongAnswered: meta.wrongIds.has(row.id),
    totalAttempts: asNumberOr(row.total_attempts, 0),
    correctAttempts: asNumberOr(row.correct_attempts, 0),
    createdAt: row.created_at,
  };
}

/**
 * Page bookkeeping for the paginated RPC.
 *
 * `total` comes from the server (`count(*) over ()`). `nextOffset` is only set
 * when another page is expected, so the UI cannot loop on an empty tail page.
 */
export function resolvePagination(input: {
  offset: number;
  limit: number;
  received: number;
  total: number;
}): { total: number; nextOffset: number | null } {
  const offset = Math.max(0, Math.floor(input.offset));
  const received = Math.max(0, Math.floor(input.received));
  const total = Math.max(Math.floor(input.total), offset + received);
  const consumed = offset + received;

  const hasMore = received > 0 && consumed < total;
  return { total, nextOffset: hasMore ? consumed : null };
}

export function buildStats(questions: QuestionBankQuestion[]): QuestionBankStats {
  return {
    total: questions.length,
    bookmarked: questions.filter((item) => item.isBookmarked).length,
    mistakes: questions.filter((item) => item.isWrongAnswered).length,
    mcq: questions.filter((item) => item.type?.toUpperCase() === 'MCQ').length,
    board: questions.filter((item) => item.sourceType === 'board_exam').length,
    premium: questions.filter((item) => item.isPremium).length,
  };
}

/** Removes rows repeated by an unstable page boundary without reordering. */
export function dedupeQuestions(
  questions: QuestionBankQuestion[]
): QuestionBankQuestion[] {
  const seen = new Set<string>();
  return questions.filter((question) => {
    if (seen.has(question.id)) return false;
    seen.add(question.id);
    return true;
  });
}

export function applySearch(
  questions: QuestionBankQuestion[],
  search: string
): QuestionBankQuestion[] {
  const normalized = search.trim().toLowerCase();
  if (!normalized) return questions;

  return questions.filter((question) => {
    const haystacks = [
      question.body.text_bn,
      question.body.text_en,
      question.explanation?.bn,
      question.explanation?.en,
      question.subjectNameBn,
      question.subjectNameEn,
      question.chapterNameBn,
      question.chapterNameEn,
      question.topicNameBn,
      question.topicNameEn,
      ...question.tags,
      ...question.options.map((option) => option.text_bn ?? ''),
      ...question.options.map((option) => option.text_en ?? ''),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystacks.includes(normalized);
  });
}

/**
 * Client-side filter/sort pass.
 *
 * Used as the whole pipeline in "legacy" mode (the v1 RPC has no server-side
 * filters) and only for presentation-order guarantees in "paged" mode, where
 * the server already applied every filter.
 */
export function applyClientSideFilters(
  questions: QuestionBankQuestion[],
  filters: QuestionBankFilterState
): QuestionBankQuestion[] {
  let result = [...questions];

  if (filters.bookmarkedOnly) result = result.filter((item) => item.isBookmarked);
  if (filters.mistakesOnly) result = result.filter((item) => item.isWrongAnswered);
  if (filters.premiumOnly) result = result.filter((item) => item.isPremium);

  if (filters.institutionType) {
    const expectedSource =
      filters.institutionType === 'board'
        ? 'board_exam'
        : filters.institutionType === 'college'
          ? 'college_test'
          : filters.institutionType;
    result = result.filter((item) => item.sourceType === expectedSource);
  }

  if (filters.institutionEiin) {
    result = result.filter((question) =>
      question.examReferences.some(
        (ref) =>
          ref.eiin === filters.institutionEiin ||
          ref.code === filters.institutionEiin
      )
    );
  }

  if (filters.year) {
    result = result.filter((question) => {
      const inTags = question.tags.includes(filters.year);
      const inRef = question.examReferences.some(
        (ref) => String(ref.year) === filters.year
      );
      return inTags || inRef;
    });
  }

  if (filters.search.trim()) {
    result = applySearch(result, filters.search);
  }

  return sortQuestions(result, filters.sortBy);
}

export function sortQuestions(
  questions: QuestionBankQuestion[],
  sortBy: QuestionBankFilterState['sortBy']
): QuestionBankQuestion[] {
  const byCreatedAt = (a: QuestionBankQuestion, b: QuestionBankQuestion) =>
    (a.createdAt ? new Date(a.createdAt).getTime() : 0) -
    (b.createdAt ? new Date(b.createdAt).getTime() : 0);

  /** Stable tiebreaker so equal keys keep the server's page order. */
  const tiebreak = (a: QuestionBankQuestion, b: QuestionBankQuestion) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

  const sorted = [...questions];

  switch (sortBy) {
    case 'oldest':
      sorted.sort((a, b) => byCreatedAt(a, b) || tiebreak(a, b));
      break;
    case 'most_attempted':
      sorted.sort((a, b) => b.totalAttempts - a.totalAttempts || tiebreak(a, b));
      break;
    case 'least_attempted':
      sorted.sort((a, b) => a.totalAttempts - b.totalAttempts || tiebreak(a, b));
      break;
    case 'newest':
    default:
      sorted.sort((a, b) => byCreatedAt(b, a) || tiebreak(a, b));
      break;
  }

  return sorted;
}
