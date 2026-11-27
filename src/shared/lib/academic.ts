import { localizeDigits, type AppLanguage } from '@/shared/i18n/messages';

/**
 * The batch and goal vocabulary every screen shares.
 *
 * A batch is a permanent identity ("HSC 2026 ব্যাচ"); the goal is the current
 * target and can change. Neither is ever printed as a bare database value, and
 * the word "শ্রেণি" never appears next to a batch.
 */
export const STUDY_GOALS = ['hsc', 'medical', 'engineering', 'varsity'] as const;

export type StudyGoal = (typeof STUDY_GOALS)[number];

/** Goals that mean admission preparation, not the HSC exam itself. */
export const ADMISSION_GOALS = ['varsity', 'medical', 'engineering'] as const;

export type AdmissionGoal = (typeof ADMISSION_GOALS)[number];

/** Mirrors the server's stage. Never recomputed from a device clock. */
export type StudyStage = 'studying' | 'post_hsc' | 'admission_prep';

const GOAL_LABELS: Record<StudyGoal, { bn: string; en: string }> = {
  hsc: { bn: 'HSC', en: 'HSC' },
  medical: { bn: 'মেডিকেল', en: 'Medical' },
  engineering: { bn: 'ইঞ্জিনিয়ারিং', en: 'Engineering' },
  varsity: { bn: 'ভার্সিটি', en: 'University' },
};

const GOAL_PREP_LABELS: Record<StudyGoal, { bn: string; en: string }> = {
  hsc: { bn: 'HSC প্রস্তুতি', en: 'HSC prep' },
  medical: { bn: 'মেডিকেল প্রস্তুতি', en: 'Medical prep' },
  engineering: { bn: 'ইঞ্জিনিয়ারিং প্রস্তুতি', en: 'Engineering prep' },
  varsity: { bn: 'ভার্সিটি ভর্তি প্রস্তুতি', en: 'University admission prep' },
};

const GOAL_ADMISSION_LABELS: Record<AdmissionGoal, { bn: string; en: string }> = {
  medical: { bn: 'মেডিকেল ভর্তি প্রস্তুতি', en: 'Medical admission prep' },
  engineering: { bn: 'ইঞ্জিনিয়ারিং ভর্তি প্রস্তুতি', en: 'Engineering admission prep' },
  varsity: { bn: 'ভার্সিটি ভর্তি প্রস্তুতি', en: 'University admission prep' },
};

export const isStudyGoal = (value: unknown): value is StudyGoal =>
  typeof value === 'string' && (STUDY_GOALS as readonly string[]).includes(value);

export const isAdmissionGoal = (value: unknown): value is AdmissionGoal =>
  typeof value === 'string' && (ADMISSION_GOALS as readonly string[]).includes(value);

export const isStudyStage = (value: unknown): value is StudyStage =>
  value === 'studying' || value === 'post_hsc' || value === 'admission_prep';

/** Bangla by default: this app is Bangla-first and English is the fallback. */
export const goalLabel = (
  goal: StudyGoal | string | null | undefined,
  language: AppLanguage = 'bn'
): string => (isStudyGoal(goal) ? GOAL_LABELS[goal][language] : '');

export const goalPrepLabel = (
  goal: StudyGoal | string | null | undefined,
  language: AppLanguage = 'bn'
): string => (isStudyGoal(goal) ? GOAL_PREP_LABELS[goal][language] : '');

/** The admission wording, which names the exam the student is preparing for. */
export const admissionGoalLabel = (
  goal: AdmissionGoal | string | null | undefined,
  language: AppLanguage = 'bn'
): string => (isAdmissionGoal(goal) ? GOAL_ADMISSION_LABELS[goal][language] : '');

/** A batch label always carries the permanent identity, never the class. */
export const formatBatchLabel = (
  hscBatch: string | null | undefined,
  language: AppLanguage = 'bn'
): string | null => {
  if (typeof hscBatch !== 'string' || !/^20[0-9]{2}$/.test(hscBatch)) return null;

  const year = localizeDigits(hscBatch, language);
  return language === 'bn' ? `HSC ${year} ব্যাচ` : `HSC ${year} batch`;
};

const studentWord = (language: AppLanguage): string =>
  language === 'bn' ? 'পরীক্ষার্থী' : 'Student';

const chooseGoalWord = (language: AppLanguage): string =>
  language === 'bn' ? 'লক্ষ্য ঠিক করো' : 'Choose your goal';

const admissionPrepWord = (language: AppLanguage): string =>
  language === 'bn' ? 'ভর্তি প্রস্তুতি' : 'Admission prep';

export interface AcademicLabelProfile {
  hsc_batch?: string | null;
  study_goal?: string | null;
}

/**
 * The one line that describes a student's academic identity.
 *
 * - studying:      HSC ২০২৭ · পরীক্ষার্থী (+ · মেডিকেল প্রস্তুতি when a real goal is set)
 * - admission_prep: HSC ২০২৬ ব্যাচ · ভার্সিটি ভর্তি প্রস্তুতি
 * - post_hsc:      HSC ২০২৬ ব্যাচ · লক্ষ্য ঠিক করো
 *
 * A missing stage is treated as studying: the answer is not in yet, and showing
 * the pre-exam line is never wrong for a student who has not crossed the exam.
 */
export const formatAcademicLabel = (
  profile: AcademicLabelProfile | null | undefined,
  stage: StudyStage | null | undefined,
  language: AppLanguage = 'bn'
): string => {
  const batchYear =
    typeof profile?.hsc_batch === 'string' && /^20[0-9]{2}$/.test(profile.hsc_batch)
      ? profile.hsc_batch
      : null;
  const liveGoal = isStudyGoal(profile?.study_goal) ? profile.study_goal : null;

  if (stage === 'admission_prep') {
    const prep = isAdmissionGoal(liveGoal)
      ? goalPrepLabel(liveGoal, language)
      : admissionPrepWord(language);

    return batchYear
      ? `${formatBatchLabel(batchYear, language)} · ${prep}`
      : prep;
  }

  if (stage === 'post_hsc') {
    return batchYear
      ? `${formatBatchLabel(batchYear, language)} · ${chooseGoalWord(language)}`
      : chooseGoalWord(language);
  }

  if (!batchYear) {
    return liveGoal && isAdmissionGoal(liveGoal) ? goalPrepLabel(liveGoal, language) : '';
  }

  const base = `HSC ${localizeDigits(batchYear, language)} · ${studentWord(language)}`;

  return liveGoal && isAdmissionGoal(liveGoal)
    ? `${base} · ${goalPrepLabel(liveGoal, language)}`
    : base;
};

export type HeaderStatusKind = 'status' | 'goal';

export interface HeaderStatusChip {
  text: string;
  kind: HeaderStatusKind;
}

/**
 * The chips under a student's name on their own Profile and Progress screens.
 *
 * Unlike `formatAcademicLabel`, a missing stage is not filled in with the
 * pre-exam line: a header that guesses is worse than a header with no chip.
 * `post_hsc` also returns nothing, because the goal gate owns that moment and
 * the two screens are never reached before a goal is chosen.
 */
export const formatHeaderStatus = (
  profile: AcademicLabelProfile | null | undefined,
  stage: StudyStage | null | undefined,
  language: AppLanguage = 'bn'
): HeaderStatusChip[] => {
  if (!isStudyStage(stage)) return [];

  const batchYear =
    typeof profile?.hsc_batch === 'string' && /^20[0-9]{2}$/.test(profile.hsc_batch)
      ? profile.hsc_batch
      : null;
  const liveGoal = isStudyGoal(profile?.study_goal) ? profile.study_goal : null;

  if (stage === 'admission_prep') {
    const prep = isAdmissionGoal(liveGoal)
      ? admissionGoalLabel(liveGoal, language)
      : admissionPrepWord(language);

    return [{ text: prep, kind: 'goal' }];
  }

  if (stage === 'post_hsc') return [];

  const chips: HeaderStatusChip[] = [];

  if (batchYear) {
    chips.push({
      text: `HSC ${localizeDigits(batchYear, language)} · ${studentWord(language)}`,
      kind: 'status',
    });
  }

  if (liveGoal && isAdmissionGoal(liveGoal)) {
    chips.push({ text: goalPrepLabel(liveGoal, language), kind: 'goal' });
  }

  return chips;
};

/** Batch only, for screens that show another student and cannot know their stage. */
export const formatStudentAcademicLabel = (
  profile: AcademicLabelProfile | null | undefined,
  language: AppLanguage = 'bn'
): string =>
  [formatBatchLabel(profile?.hsc_batch, language), goalLabel(profile?.study_goal, language)]
    .filter(Boolean)
    .join(' · ');
