import type { Question } from '@/features/exam/types/exam';

/**
 * One question inside a subject section. `index` is the position in the
 * server-frozen attempt order, so numbering and answer keys always match the
 * attempt even after the questions are regrouped by subject.
 */
export interface AdmissionQuestionEntry {
  question: Question;
  index: number;
}

export interface AdmissionQuestionSection {
  key: string;
  subjectId: string | null;
  nameBn: string | null;
  nameEn: string | null;
  entries: AdmissionQuestionEntry[];
}

const UNKNOWN_SECTION_KEY = 'subject:unknown';

const subjectIdOf = (question: Question): string | null => {
  const fromSubject =
    typeof question.subject?.id === 'string' ? question.subject.id.trim() : '';
  if (fromSubject) return fromSubject;

  const fromRow =
    typeof question.subject_id === 'string' ? question.subject_id.trim() : '';
  return fromRow || null;
};

/**
 * Groups the attempt questions by subject while preserving both orders:
 * sections appear in the order their first question occurs in the attempt, and
 * questions keep their original sequence and numbering inside a section.
 *
 * Questions without subject metadata are not dropped; they go into one
 * localized fallback section.
 */
export const groupQuestionsBySubject = (
  questions: Question[]
): AdmissionQuestionSection[] => {
  const sections = new Map<string, AdmissionQuestionSection>();

  questions.forEach((question, index) => {
    const subjectId = subjectIdOf(question);
    const key = subjectId ? `subject:${subjectId}` : UNKNOWN_SECTION_KEY;

    let section = sections.get(key);

    if (!section) {
      section = {
        key,
        subjectId,
        nameBn: question.subject?.name_bn ?? null,
        nameEn: question.subject?.name_en ?? null,
        entries: [],
      };
      sections.set(key, section);
    } else {
      // A later row may carry the label the first one lacked (partial joins).
      section.nameBn = section.nameBn ?? question.subject?.name_bn ?? null;
      section.nameEn = section.nameEn ?? question.subject?.name_en ?? null;
    }

    section.entries.push({ question, index });
  });

  return [...sections.values()];
};

/** Stable DOM id used by the navigator and the scroll-spy. */
export const admissionQuestionAnchorId = (questionId: string): string =>
  `admission-question-${questionId}`;
