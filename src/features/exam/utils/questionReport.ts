import type { QuestionMetaData } from '@/shared/components/feedback/ReportModal';
import { pickLang } from '@/shared/i18n/localize';

export interface ReportQuestionLike {
  id: string;
  text?: string;
  text_bn?: string | null;
  text_en?: string | null;
  body?:
    | {
        text?: string | null;
        text_bn?: string | null;
        text_en?: string | null;
        image_url?: string | null;
      }
    | string
    | null;
  options?: Array<{
    id?: string;
    text?: string;
    text_bn?: string | null;
    text_en?: string | null;
  }>;
  image_url?: string | null;
  media_library?: { file_url?: string | null } | null;
}

const normalizeText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

/**
 * Resolves the question text the same way the question cards do: localized
 * body first, then the legacy top-level fields, then the original string body.
 */
export const resolveQuestionReportText = (
  question: ReportQuestionLike,
  language: string
): string => {
  let text =
    pickLang(language, question.text_bn, question.text_en) ||
    normalizeText(question.text);

  const body = question.body;

  if (body && typeof body === 'object') {
    const localized = body as Record<string, unknown>;
    text =
      pickLang(
        language,
        normalizeText(localized.text_bn),
        normalizeText(localized.text_en)
      ) ||
      normalizeText(localized.text) ||
      text;
  } else if (typeof body === 'string' && body.trim()) {
    text = body.trim();
  }

  return text.trim();
};

/**
 * Builds the report preview payload from a question already held in memory.
 * This keeps the report modal on the same localized content and rich-text
 * renderer as the exam/analysis cards without another API request.
 */
export const buildQuestionReportData = (
  question: ReportQuestionLike,
  language: string,
  examId?: string | null
): QuestionMetaData => ({
  questionId: String(question.id),
  ...(examId ? { examId } : {}),
  questionText: resolveQuestionReportText(question, language),
  questionOptions: (question.options ?? [])
    .map((option) => ({
      id: String(option.id ?? ''),
      text:
        pickLang(language, option.text_bn, option.text_en) ||
        normalizeText(option.text),
    }))
    .filter((option) => option.text.length > 0),
  imageUrl:
    question.image_url || question.media_library?.file_url || null,
});
