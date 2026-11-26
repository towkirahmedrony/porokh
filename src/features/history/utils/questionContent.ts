import { pickLang } from '@/shared/i18n/localize';
import type { AppLanguage } from '@/shared/i18n/messages';
import type { QuestionOption } from '../types/history';

/**
 * One reader for the four places a bilingual question is rendered: body,
 * option, explanation and the body image. Every surface calls this, so a raw
 * jsonb object can never reach the DOM and Bangla text never loses its
 * multi-statement line breaks.
 */

const BANGLA_LETTERS = ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ'];
const LATIN_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export const optionLetter = (index: number, language: AppLanguage): string =>
  language === 'bn'
    ? BANGLA_LETTERS[index] ?? String(index + 1)
    : LATIN_LETTERS[index] ?? String(index + 1);

const parseIfJson = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

export const readLocalizedText = (
  value: unknown,
  language: AppLanguage
): string => {
  const parsed = parseIfJson(value);
  if (!parsed) return '';
  if (typeof parsed === 'string') return parsed.trim();
  if (typeof parsed !== 'object') return String(parsed).trim();

  const record = parsed as Record<string, unknown>;
  const preferred = pickLang(
    language,
    typeof record.text_bn === 'string' ? record.text_bn : typeof record.bn === 'string' ? record.bn : null,
    typeof record.text_en === 'string' ? record.text_en : typeof record.en === 'string' ? record.en : null
  );

  if (preferred) return preferred.trim();

  const fallbacks = [record.text, record.content, record.html]
    .filter((item): item is string => typeof item === 'string' && item.trim() !== '');

  return (fallbacks[0] ?? '').trim();
};

export const readOptionText = (
  option: QuestionOption,
  language: AppLanguage
): string =>
  pickLang(language, option.text_bn, option.text_en) ||
  (typeof option.bn === 'string' ? option.bn : '') ||
  (typeof option.text === 'string' ? option.text : '') ||
  (typeof option.en === 'string' ? option.en : '');

export const isCorrectOption = (option: QuestionOption | null | undefined): boolean => {
  if (!option) return false;

  return (
    option.isCorrect === true ||
    option.is_correct === true ||
    option.correct === true ||
    option.answer === true ||
    String(option.isCorrect).toLowerCase() === 'true' ||
    String(option.is_correct).toLowerCase() === 'true'
  );
};

export const normalizeOptionId = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value).trim();

export const hasCorrectOption = (options: QuestionOption[]): boolean =>
  options.some(isCorrectOption);

export const findCorrectOption = (options: QuestionOption[]): QuestionOption | null =>
  options.find(isCorrectOption) ?? null;

/** Body image can live on the row or inside the body jsonb. */
export const readBodyImageUrl = (question: {
  image_url?: string | null;
  body?: unknown;
  media_library?: { file_url?: string | null } | null;
} | null): string | null => {
  if (!question) return null;

  if (typeof question.image_url === 'string' && question.image_url) {
    return question.image_url;
  }

  const body = parseIfJson(question.body);
  if (body && typeof body === 'object') {
    const image = (body as Record<string, unknown>).image_url;
    if (typeof image === 'string' && image) return image;
  }

  return question.media_library?.file_url ?? null;
};

/**
 * True when the answer key must stay hidden. A live exam paper's questions keep
 * the key hidden even after the student taps reveal: the backend already strips
 * `isCorrect` in that case, and this guard makes the UI honest about it.
 */
export const hasAnswerKey = (options: QuestionOption[]): boolean =>
  hasCorrectOption(options);
