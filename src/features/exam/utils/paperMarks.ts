import { localizeDigits, type AppLanguage } from '@/shared/i18n/messages';

/**
 * The paper list stores the total marks and the number of questions, so the
 * per-question value must be derived from those two numbers instead of trusting
 * a fixed "1 mark" sentence in the admin-authored instructions.
 */
export const getMarksPerQuestion = (paper: {
  total_marks: number | null;
  question_count: number | null;
}): number | null => {
  const totalMarks = Number(paper.total_marks);
  const questionCount = Number(paper.question_count);

  if (!Number.isFinite(totalMarks) || !Number.isFinite(questionCount)) return null;
  if (totalMarks <= 0 || questionCount <= 0) return null;

  return Number((totalMarks / questionCount).toFixed(2));
};

const formatMarks = (marks: number, language: AppLanguage): string => {
  const value = Number.isInteger(marks) ? String(marks) : marks.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return localizeDigits(value, language);
};

const NUMBER = '[০-৯0-9]+(?:\\.[০-৯0-9]+)?';

/**
 * Keep the admin-authored instructions readable while replacing any
 * per-question marks claim with the value derived from the paper itself.
 * Only sentences that talk about marks per question are touched.
 */
export const syncInstructionMarks = (
  text: string,
  marksPerQuestion: number,
  language: AppLanguage
): string => {
  const marks = formatMarks(marksPerQuestion, language);
  const englishMarkWord = marksPerQuestion === 1 ? 'mark' : 'marks';

  return text
    // "প্রতিটি প্রশ্নের ১ নম্বর" / "প্রতিটি প্রশ্নের জন্য এক নম্বর" / "প্রতিটি প্রশ্নের মান ১ নম্বর"
    .replace(
      new RegExp(
        `(প্রতিটি প্রশ্নের(?:\\s+জন্য)?(?:\\s+মান)?\\s*)(${NUMBER}|এক)(\\s*নম্বর)`,
        'g'
      ),
      `$1${marks}$3`
    )
    // "প্রতিটি প্রশ্নের মান ১.২৫"
    .replace(new RegExp(`(প্রতিটি প্রশ্নের মান\\s*)(${NUMBER})`, 'g'), `$1${marks}`)
    // "প্রশ্নের মান ১"
    .replace(new RegExp(`(প্রশ্নের মান\\s*)(${NUMBER})`, 'g'), `$1${marks}`)
    // "মান ১" (e.g. "প্রশ্ন ১০০, মান ১, সময় ...")
    .replace(new RegExp(`(মান\\s*)(${NUMBER})`, 'g'), `$1${marks}`)
    // "প্রতি প্রশ্নে ১ নম্বর / ১ মার্ক"
    .replace(
      new RegExp(`(প্রতি প্রশ্নে\\s*)(${NUMBER})(\\s*(?:নম্বর|মার্ক))`, 'g'),
      `$1${marks}$3`
    )
    // "Each question carries 1 mark"
    .replace(
      new RegExp(`(each question carries\\s*)(${NUMBER})(\\s*marks?)`, 'gi'),
      (_match, prefix) => `${prefix}${marks} ${englishMarkWord}`
    )
    // "1 mark per question" / "1 mark for each question"
    .replace(
      new RegExp(
        `(${NUMBER})(\\s*)marks?(\\s*(?:for\\s+)?(?:per|each)\\s+question)`,
        'gi'
      ),
      (_match, _value, space, suffix) => `${marks}${space}${englishMarkWord}${suffix}`
    )
    // "One mark for each correct answer"
    .replace(
      /(one mark for each correct answer)/gi,
      `${marks} ${englishMarkWord} for each correct answer`
    );
};
