import type {
  AdmissionExam,
  AdmissionExamType,
  AdmissionPaperMode,
  AdmissionSessionGroup,
  AdmissionSubjectOption,
  AdmissionUnitContent,
  AdmissionUnitPaper,
  AdmissionUniversityEntry,
} from '../types/admission';

/**
 * Pure adapter for the unit-first admission navigation.
 *
 * The browsing identifiers (university id, unit id) are database ids from
 * `admission_units`, not slugs derived from metadata. Unit content itself is
 * assembled by the backend so published/eligible filtering, session grouping and
 * the subject question pool are never decided in the browser.
 *
 * Raw row shapes are declared here so the Supabase and API boundaries both map
 * through one function instead of duplicating field names at each call site.
 */

export interface RawAdmissionUnitRow {
  id: string;
  institution_id: string | null;
  name_bn: string;
  name_en: string | null;
  code: string;
  display_order: number | null;
  is_active: boolean | null;
}

export interface RawAdmissionInstitutionRow {
  id: string;
  name_bn: string;
  name_en: string | null;
  short_name: string | null;
  slug: string | null;
  location: string | null;
  district: string | null;
  is_active: boolean | null;
}

type Raw = Record<string, unknown>;

const asRecord = (value: unknown): Raw | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Raw)
    : null;

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

const nullableText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;

const numberOrNull = (value: unknown): number | null => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
};

const nonNegativeInt = (value: unknown): number => {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
};

const isMode = (value: unknown): value is AdmissionPaperMode =>
  value === 'past_exam' || value === 'subject_practice' || value === 'model_test';

/**
 * Groups active units by their active university. Units without a resolvable
 * university are dropped rather than shown under an invented one.
 */
export const buildUniversityUnits = (
  units: RawAdmissionUnitRow[],
  institutions: RawAdmissionInstitutionRow[],
  paperCountsByUnit: ReadonlyMap<string, number> = new Map()
): AdmissionUniversityEntry[] => {
  const institutionsById = new Map(
    institutions
      .filter((institution) => institution.is_active !== false)
      .map((institution) => [institution.id, institution])
  );

  const universities = new Map<string, AdmissionUniversityEntry>();

  for (const unit of units) {
    if (unit.is_active === false) continue;

    const institution = unit.institution_id
      ? institutionsById.get(unit.institution_id)
      : undefined;

    if (!institution) continue;

    let entry = universities.get(institution.id);

    if (!entry) {
      entry = {
        id: institution.id,
        nameBn: institution.name_bn,
        nameEn: institution.name_en ?? null,
        shortName: institution.short_name ?? null,
        slug: institution.slug ?? null,
        location: institution.location ?? institution.district ?? null,
        units: [],
        paperCount: 0,
      };
      universities.set(institution.id, entry);
    }

    const paperCount = paperCountsByUnit.get(unit.id) ?? 0;

    entry.units.push({
      id: unit.id,
      institutionId: institution.id,
      nameBn: unit.name_bn,
      nameEn: unit.name_en ?? null,
      code: unit.code,
      displayOrder: unit.display_order ?? 0,
      paperCount,
    });
    entry.paperCount += paperCount;
  }

  return [...universities.values()]
    .map((university) => ({
      ...university,
      units: university.units
        .slice()
        .sort(
          (a, b) =>
            a.displayOrder - b.displayOrder ||
            a.nameBn.localeCompare(b.nameBn) ||
            a.code.localeCompare(b.code)
        ),
    }))
    .sort(
      (a, b) =>
        b.paperCount - a.paperCount ||
        a.nameBn.localeCompare(b.nameBn) ||
        a.id.localeCompare(b.id)
    );
};

const mapUnitPaper = (value: unknown): AdmissionUnitPaper | null => {
  const paper = asRecord(value);
  if (!paper || typeof paper.id !== 'string') return null;

  return {
    id: paper.id,
    title: text(paper.title),
    titleEn: nullableText(paper.title_en),
    mode: isMode(paper.mode) ? paper.mode : null,
    session: nullableText(paper.session),
    modelTestNo: numberOrNull(paper.model_test_no),
    durationMin: numberOrNull(paper.duration_min),
    totalMarks: numberOrNull(paper.total_marks),
    questionCount: nonNegativeInt(paper.question_count),
    isPremium: paper.is_premium === true,
    startTime: nullableText(paper.start_time),
    endTime: nullableText(paper.end_time),
    defaultNegativeMarks: numberOrNull(paper.default_negative_marks),
  };
};

const mapSubject = (value: unknown): AdmissionSubjectOption | null => {
  const subject = asRecord(value);
  if (!subject || typeof subject.id !== 'string') return null;

  return {
    id: subject.id,
    nameBn: text(subject.name_bn),
    nameEn: nullableText(subject.name_en),
    slug: nullableText(subject.slug),
    isPremium: subject.is_premium === true,
    questionCount: nonNegativeInt(subject.question_count),
    chapters: asArray(subject.chapters)
      .map((chapterValue) => {
        const chapter = asRecord(chapterValue);
        if (!chapter || typeof chapter.id !== 'string') return null;

        return {
          id: chapter.id,
          nameBn: text(chapter.name_bn),
          nameEn: nullableText(chapter.name_en),
          questionCount: nonNegativeInt(chapter.question_count),
        };
      })
      .filter((chapter): chapter is AdmissionSubjectOption['chapters'][number] =>
        chapter !== null
      ),
  };
};

/** Maps the backend unit-content payload; malformed entries are dropped, not guessed. */
export const mapUnitContent = (payload: unknown): AdmissionUnitContent => {
  const raw = asRecord(payload) ?? {};
  const unit = asRecord(raw.unit) ?? {};
  const university = asRecord(raw.university);

  const pastExams: AdmissionSessionGroup[] = asArray(raw.past_exams)
    .map((groupValue) => {
      const group = asRecord(groupValue);
      if (!group) return null;

      const papers = asArray(group.papers)
        .map(mapUnitPaper)
        .filter((paper): paper is AdmissionUnitPaper => paper !== null);

      if (papers.length === 0) return null;

      return { session: nullableText(group.session), papers };
    })
    .filter((group): group is AdmissionSessionGroup => group !== null);

  const modelTests = asArray(raw.model_tests)
    .map(mapUnitPaper)
    .filter((paper): paper is AdmissionUnitPaper => paper !== null);

  const subjects = asArray(raw.subjects)
    .map(mapSubject)
    .filter((subject): subject is AdmissionSubjectOption => subject !== null);

  return {
    unit: {
      id: text(unit.id),
      institutionId: text(unit.institution_id),
      nameBn: text(unit.name_bn),
      nameEn: nullableText(unit.name_en),
      code: text(unit.code),
      description: nullableText(unit.description),
      displayOrder: numberOrNull(unit.display_order) ?? 0,
    },
    university: university
      ? {
          id: text(university.id),
          nameBn: text(university.name_bn),
          nameEn: nullableText(university.name_en),
          shortName: nullableText(university.short_name),
          slug: nullableText(university.slug),
          location: nullableText(university.location),
        }
      : null,
    pastExams,
    modelTests,
    subjects,
  };
};

/** Year embedded in a session label, used for the paper card label. */
export const sessionYear = (session: string | null): number | null => {
  const match = session?.match(/(19|20)\d{2}/);
  if (!match) return null;

  const parsed = Number(match[0]);

  return parsed >= 1950 && parsed <= 2100 ? parsed : null;
};

/**
 * Maps a unit paper onto the existing exam card contract. Past exam cards and
 * model test cards therefore keep one layout while the unit list supplies the
 * session heading.
 */
export const toAdmissionExam = (
  paper: AdmissionUnitPaper,
  examType: AdmissionExamType
): AdmissionExam => ({
  id: paper.id,
  title: paper.title,
  groupSlug: null,
  examType,
  universityId: null,
  unit: null,
  year: sessionYear(paper.session),
  modelTestNo: paper.modelTestNo,
  durationMin: paper.durationMin,
  totalMarks: paper.totalMarks,
  questionCount: paper.questionCount,
  isPublished: true,
  isPremium: paper.isPremium,
  startTime: paper.startTime,
  endTime: paper.endTime,
  createdAt: null,
  order: null,
  subjectNameBn: null,
  subjectNameEn: null,
});

/** True when the unit has at least one section to show. */
export const hasUnitContent = (content: AdmissionUnitContent): boolean =>
  content.pastExams.length > 0 ||
  content.modelTests.length > 0 ||
  content.subjects.length > 0;
