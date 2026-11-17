import type {
  AdmissionCatalog,
  AdmissionExam,
  AdmissionExamPaperRow,
  AdmissionExamType,
  AdmissionGroup,
  AdmissionInstitutionRow,
  AdmissionUnit,
  AdmissionUnitSummary,
  AdmissionUniversity,
} from '../types/admission';

/**
 * Pure adapter between the existing Porokh schema and the admission browsing
 * experience.
 *
 * Existing schema used here (no backend changes):
 * - `exam_papers` with `category = 'admission'`, `is_published`, `meta_data`
 * - `institutions` with `type = 'admission'`
 *
 * `meta_data` is the only optional-shape part. The adapter reads the following
 * keys defensively (all optional):
 *
 *   group | stream | group_slug | stream_slug
 *   university_id | institution_id | university_slug | institution_slug
 *   unit | unit_slug | unit_code | unit_name | unit_name_bn
 *   year | exam_year | model_test_no | model_no | order | sequence
 *   exam_type | type
 *
 * This contract is documented for the backend/content team; the frontend never
 * invents universities, years, marks or question counts.
 */

const GROUP_TERMS: ReadonlyArray<{ slug: string; terms: string[] }> = [
  { slug: 'science', terms: ['science', 'বিজ্ঞান', 'biggan'] },
  { slug: 'arts', terms: ['arts', 'humanities', 'মানবিক', 'কলা'] },
  {
    slug: 'commerce',
    terms: ['commerce', 'businessstudies', 'ব্যবসায়', 'ব্যবসায়শিক্ষা', 'ব্যবসা'],
  },
];

const CANONICAL_GROUP_LABELS: Record<
  string,
  { nameBn: string; nameEn: string }
> = {
  science: { nameBn: 'বিজ্ঞান', nameEn: 'Science' },
  arts: { nameBn: 'মানবিক', nameEn: 'Arts' },
  commerce: { nameBn: 'ব্যবসায় শিক্ষা', nameEn: 'Commerce' },
};

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toLatinDigits = (value: string): string =>
  value.replace(/[০-৯]/g, (digit) =>
    String(BN_DIGITS.indexOf(digit))
  );

const cleanString = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const firstText = (
  source: Record<string, unknown> | null,
  keys: string[]
): string | null => {
  if (!source) return null;
  for (const key of keys) {
    const value = cleanString(source[key]);
    if (value) return value;
  }
  return null;
};

const parseNumber = (value: unknown): number | null => {
  const raw = cleanString(value);
  if (!raw) return null;
  const parsed = Number(toLatinDigits(raw).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};

const firstNumber = (
  source: Record<string, unknown> | null,
  keys: string[]
): number | null => {
  if (!source) return null;
  for (const key of keys) {
    const value = parseNumber(source[key]);
    if (value !== null) return value;
  }
  return null;
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const normalizeMatchKey = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, '');

const UNIVERSITY_SUFFIX = /(university|বিশ্ববিদ্যালয়|univ)$/u;

const matchKeysForName = (value: string): string[] => {
  const key = normalizeMatchKey(value);
  if (!key) return [];
  const stripped = key.replace(UNIVERSITY_SUFFIX, '');
  return stripped.length >= 3 && stripped !== key ? [key, stripped] : [key];
};

export const normalizeGroupSlug = (value: string | null): string | null => {
  const raw = cleanString(value);
  if (!raw) return null;

  const compact = raw
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\s_\-–—.()/]+/g, '');

  for (const entry of GROUP_TERMS) {
    if (entry.terms.some((term) => compact.includes(term))) return entry.slug;
  }

  // A backend-defined group can still be addressed by its own latin slug.
  return slugify(raw) || null;
};

export const parseAdmissionExamType = (
  value: string | null | undefined
): AdmissionExamType | null => {
  const normalized = cleanString(value)?.toLowerCase().replace(/_/g, '-');
  if (!normalized) return null;
  if (normalized === 'model-test' || normalized === 'model-test-exam') {
    return 'model-test';
  }
  if (normalized === 'past-exams' || normalized === 'past-exam') {
    return 'past-exams';
  }
  return null;
};

const resolveExamType = (
  paper: AdmissionExamPaperRow,
  meta: Record<string, unknown> | null
): AdmissionExamType | null => {
  const declared = [
    firstText(meta, [
      'exam_type',
      'type',
      'test_type',
      'paper_type',
      'admission_type',
    ]),
    cleanString(paper.exam_type),
    cleanString(paper.category),
  ].filter((value): value is string => Boolean(value));

  for (const raw of declared) {
    const normalized = raw.toLowerCase();
    if (/model/i.test(normalized)) return 'model-test';
    if (/past|previous|question|board|year/i.test(normalized)) {
      return 'past-exams';
    }
  }

  if (resolveYear(paper, meta) !== null) return 'past-exams';
  if (resolveModelTestNo(paper, meta) !== null) return 'model-test';

  return null;
};

const resolveYear = (
  paper: AdmissionExamPaperRow,
  meta: Record<string, unknown> | null
): number | null => {
  const declared = firstNumber(meta, [
    'year',
    'exam_year',
    'admission_year',
    'session_year',
  ]);

  if (declared !== null && declared >= 1950 && declared <= 2100) {
    return Math.trunc(declared);
  }

  const fromTitle = toLatinDigits(paper.title).match(/\b(19|20)\d{2}\b/);
  if (!fromTitle) return null;

  const parsed = Number(fromTitle[0]);
  return parsed >= 1950 && parsed <= 2100 ? parsed : null;
};

const resolveModelTestNo = (
  paper: AdmissionExamPaperRow,
  meta: Record<string, unknown> | null
): number | null => {
  const declared = firstNumber(meta, [
    'model_test_no',
    'model_test_number',
    'model_no',
    'test_no',
    'paper_no',
  ]);

  if (declared !== null) return Math.trunc(declared);

  const fromTitle = toLatinDigits(paper.title).match(
    /(?:model|মডেল)\s*(?:test|টেস্ট)?\s*[-–#:]?\s*(\d{1,3})/i
  );

  return fromTitle ? Number(fromTitle[1]) : null;
};

const resolveOrder = (
  meta: Record<string, unknown> | null
): number | null => {
  const declared = firstNumber(meta, [
    'order',
    'sequence',
    'display_order',
    'sort_order',
  ]);
  return declared !== null ? declared : null;
};

const resolveGroup = (
  meta: Record<string, unknown> | null
): { slug: string; nameBn?: string; nameEn?: string } | null => {
  if (!meta) return null;

  const candidates: unknown[] = [
    meta.group,
    meta.stream,
    meta.groups,
    meta.group_slug,
    meta.stream_slug,
    meta.group_name,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      for (const entry of candidate) {
        const resolved = resolveGroupEntry(entry);
        if (resolved) return resolved;
      }
      continue;
    }

    const resolved = resolveGroupEntry(candidate);
    if (resolved) return resolved;
  }

  return null;
};

const resolveGroupEntry = (
  entry: unknown
): { slug: string; nameBn?: string; nameEn?: string } | null => {
  if (isRecord(entry)) {
    const rawSlug = firstText(entry, ['slug', 'key', 'code', 'id']);
    const nameBn = firstText(entry, ['name_bn', 'nameBn', 'bn', 'name']);
    const nameEn = firstText(entry, ['name_en', 'nameEn', 'en']);
    const slug = normalizeGroupSlug(rawSlug ?? nameEn ?? nameBn);
    return slug ? { slug, nameBn: nameBn ?? undefined, nameEn: nameEn ?? undefined } : null;
  }

  const raw = cleanString(entry);
  if (!raw) return null;
  const slug = normalizeGroupSlug(raw);
  return slug ? { slug, nameBn: raw } : null;
};

const UNIT_SLUG_MAP: Record<string, string> = {
  ক: 'ka',
  a: 'ka',
  খ: 'kha',
  b: 'kha',
  গ: 'ga',
  c: 'ga',
  ঘ: 'gha',
  d: 'gha',
  ঙ: 'umo',
  e: 'umo',
};

export const normalizeUnitSlug = (value: string): string => {
  const raw = cleanString(value) ?? '';
  const key = raw
    .toLowerCase()
    .normalize('NFKC')
    .replace(/unit|ইউনিট|[().\s-]+/g, '');

  if (UNIT_SLUG_MAP[key]) return UNIT_SLUG_MAP[key];

  const latin = slugify(raw);
  if (latin) return latin;

  return encodeURIComponent(raw.trim()) || 'unit';
};

const resolveUnit = (
  meta: Record<string, unknown> | null
): AdmissionUnit | null => {
  if (!meta) return null;

  const unitObject = isRecord(meta.unit) ? meta.unit : null;
  const raw =
    firstText(meta, [
      'unit_slug',
      'unit_code',
      'unit',
      'unit_name',
      'unit_name_bn',
      'unit_name_en',
    ]) ??
    firstText(unitObject, ['slug', 'code', 'name_bn', 'name', 'name_en']);

  if (!raw) return null;

  const objectSlug = firstText(unitObject, ['slug', 'code']);
  const objectNameBn = firstText(unitObject, ['name_bn', 'nameBn', 'bn', 'name']);
  const objectNameEn = firstText(unitObject, ['name_en', 'nameEn', 'en']);

  const slug = normalizeUnitSlug(objectSlug ?? raw);
  const nameBn = objectNameBn ?? raw;
  const nameEn = objectNameEn ?? null;

  return { slug, nameBn, nameEn };
};

const buildInstitutionIndex = (institutions: AdmissionInstitutionRow[]) => {
  const byId = new Map<string, AdmissionInstitutionRow>();
  const byKey = new Map<string, AdmissionInstitutionRow>();

  const register = (value: string | null | undefined, institution: AdmissionInstitutionRow) => {
    if (!value) return;
    for (const key of matchKeysForName(value)) {
      if (!byKey.has(key)) byKey.set(key, institution);
    }
  };

  for (const institution of institutions) {
    byId.set(institution.id, institution);
    register(institution.id, institution);
    register(institution.slug, institution);
    register(institution.code, institution);
    register(institution.name_bn, institution);
    register(institution.name_en, institution);
    register(institution.short_name, institution);
    for (const alias of institution.aliases ?? []) register(alias, institution);
  }

  return { byId, byKey };
};

const resolveInstitution = (
  meta: Record<string, unknown> | null,
  index: ReturnType<typeof buildInstitutionIndex>
): AdmissionInstitutionRow | null => {
  if (!meta) return null;

  const universityObject = isRecord(meta.university) ? meta.university : null;

  const idCandidates = [
    firstText(meta, ['university_id', 'institution_id']),
    firstText(universityObject, ['id']),
  ].filter((value): value is string => Boolean(value));

  for (const id of idCandidates) {
    const match = index.byId.get(id);
    if (match) return match;
  }

  const keyCandidates = [
    firstText(meta, [
      'university_slug',
      'institution_slug',
      'university_code',
      'institution_code',
      'university',
      'university_name',
      'university_name_bn',
      'university_name_en',
      'institution',
      'institution_name',
      'institution_name_bn',
      'institution_name_en',
    ]),
    firstText(universityObject, ['slug', 'code', 'name_bn', 'name', 'name_en']),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of keyCandidates) {
    for (const key of matchKeysForName(candidate)) {
      const match = index.byKey.get(key);
      if (match) return match;
    }
  }

  return null;
};

const makeUniversitySlug = (
  institution: AdmissionInstitutionRow,
  used: Set<string>
): string => {
  const base =
    slugify(institution.slug ?? '') ||
    slugify(institution.name_en ?? '') ||
    slugify(institution.short_name ?? '') ||
    slugify(institution.code ?? '') ||
    slugify(institution.name_bn ?? '') ||
    institution.id;

  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
};

const buildGroup = (
  slug: string,
  overrides?: { nameBn?: string; nameEn?: string }
): AdmissionGroup => {
  const canonical = CANONICAL_GROUP_LABELS[slug];
  const fallbackName =
    canonical?.nameEn ?? slug.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

  return {
    slug,
    nameBn: overrides?.nameBn ?? canonical?.nameBn ?? fallbackName,
    nameEn: overrides?.nameEn ?? canonical?.nameEn ?? fallbackName,
    examCounts: { 'model-test': 0, 'past-exams': 0 },
    totalExams: 0,
  };
};

export const buildAdmissionCatalog = (
  papers: AdmissionExamPaperRow[],
  institutions: AdmissionInstitutionRow[],
  questionCounts: ReadonlyMap<string, number> = new Map()
): AdmissionCatalog => {
  const index = buildInstitutionIndex(institutions);
  const groups = new Map<string, AdmissionGroup>();
  const universities = new Map<string, AdmissionUniversity>();
  const usedUniversitySlugs = new Set<string>();
  const exams: AdmissionExam[] = [];

  const diagnostics = {
    totalPapers: papers.length,
    missingGroup: 0,
    missingUniversity: 0,
    missingExamType: 0,
  };

  for (const institution of institutions) {
    const university: AdmissionUniversity = {
      id: institution.id,
      slug: makeUniversitySlug(institution, usedUniversitySlugs),
      nameBn: institution.name_bn,
      nameEn: institution.name_en,
      shortName: institution.short_name,
      location: institution.location ?? institution.district,
      totalExams: 0,
      examCounts: { 'model-test': 0, 'past-exams': 0 },
      unitCount: 0,
    };
    universities.set(university.id, university);
  }

  for (const paper of papers) {
    if (paper.is_published === false) continue;

    const meta = isRecord(paper.meta_data) ? paper.meta_data : null;
    const group = resolveGroup(meta);
    const examType = resolveExamType(paper, meta);
    const institution = resolveInstitution(meta, index);
    const unit = resolveUnit(meta);
    const year = resolveYear(paper, meta);
    const modelTestNo = resolveModelTestNo(paper, meta);

    if (!group) diagnostics.missingGroup += 1;
    if (!institution) diagnostics.missingUniversity += 1;
    if (!examType) diagnostics.missingExamType += 1;

    if (group) {
      const existing = groups.get(group.slug);
      if (existing) {
        existing.nameBn = group.nameBn ?? existing.nameBn;
        existing.nameEn = group.nameEn ?? existing.nameEn;
      } else {
        groups.set(group.slug, buildGroup(group.slug, group));
      }
    }

    const exam: AdmissionExam = {
      id: paper.id,
      title: paper.title,
      groupSlug: group?.slug ?? null,
      examType,
      universityId: institution?.id ?? null,
      unit,
      year,
      modelTestNo,
      durationMin: paper.duration_min ?? null,
      totalMarks: paper.total_marks ?? null,
      questionCount: questionCounts.get(paper.id) ?? null,
      isPublished: paper.is_published === true,
      isPremium: paper.is_premium === true,
      startTime: paper.start_time ?? null,
      endTime: paper.end_time ?? null,
      createdAt: paper.created_at ?? null,
      order: resolveOrder(meta),
      subjectNameBn: paper.subjects?.name_bn ?? null,
      subjectNameEn: paper.subjects?.name_en ?? null,
    };

    exams.push(exam);

    if (group && examType) {
      let groupRecord = groups.get(group.slug);
      if (!groupRecord) {
        groupRecord = buildGroup(group.slug, group);
        groups.set(group.slug, groupRecord);
      }
      groupRecord.examCounts[examType] += 1;
      groupRecord.totalExams += 1;
    }

    if (institution) {
      const university = universities.get(institution.id);
      if (university) {
        university.totalExams += 1;
        if (examType) university.examCounts[examType] += 1;
      }
    }
  }

  const unitsByUniversity = new Map<string, Set<string>>();
  for (const exam of exams) {
    if (!exam.universityId || !exam.unit) continue;
    const units = unitsByUniversity.get(exam.universityId) ?? new Set<string>();
    units.add(exam.unit.slug);
    unitsByUniversity.set(exam.universityId, units);
  }

  for (const [universityId, units] of unitsByUniversity) {
    const university = universities.get(universityId);
    if (university) university.unitCount = units.size;
  }

  // Canonical streams stay navigable even before content is tagged, so the
  // admission route never depends on frontend code for its structure.
  for (const slug of ['science', 'arts', 'commerce']) {
    if (!groups.has(slug)) groups.set(slug, buildGroup(slug));
  }

  return {
    groups: Array.from(groups.values()).sort((a, b) => {
      const order = ['science', 'arts', 'commerce'];
      const aIndex = order.indexOf(a.slug);
      const bIndex = order.indexOf(b.slug);
      if (aIndex !== -1 || bIndex !== -1) {
        return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
      }
      return a.nameEn.localeCompare(b.nameEn);
    }),
    universities: Array.from(universities.values()),
    exams,
    diagnostics,
  };
};

export const getAdmissionGroup = (
  catalog: AdmissionCatalog,
  groupSlug: string | undefined
): AdmissionGroup | null => {
  if (!groupSlug) return null;
  return catalog.groups.find((group) => group.slug === groupSlug) ?? null;
};

export const getAdmissionUniversity = (
  catalog: AdmissionCatalog,
  universitySlug: string | undefined
): AdmissionUniversity | null => {
  if (!universitySlug) return null;
  return (
    catalog.universities.find((university) => university.slug === universitySlug) ??
    null
  );
};

export const filterAdmissionExams = (
  catalog: AdmissionCatalog,
  filters: {
    groupSlug?: string;
    examType?: AdmissionExamType;
    universityId?: string | null;
    unitSlug?: string | null;
  }
): AdmissionExam[] => {
  return catalog.exams.filter((exam) => {
    if (filters.groupSlug && exam.groupSlug !== filters.groupSlug) return false;
    if (filters.examType && exam.examType !== filters.examType) return false;
    if (filters.universityId && exam.universityId !== filters.universityId) {
      return false;
    }
    if (filters.unitSlug && exam.unit?.slug !== filters.unitSlug) return false;
    return true;
  });
};

export const getAdmissionUniversities = (
  catalog: AdmissionCatalog,
  filters: { groupSlug?: string; examType?: AdmissionExamType }
): AdmissionUniversity[] => {
  const eligible = filterAdmissionExams(catalog, filters);
  const byId = new Map<string, AdmissionUniversity>();

  for (const university of catalog.universities) {
    byId.set(university.id, university);
  }

  const counts = new Map<string, number>();
  for (const exam of eligible) {
    if (!exam.universityId) continue;
    counts.set(exam.universityId, (counts.get(exam.universityId) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([id, count]) => {
      const university = byId.get(id);
      if (!university) return null;
      return { ...university, totalExams: count };
    })
    .filter((value): value is AdmissionUniversity => value !== null)
    .sort((a, b) => b.totalExams - a.totalExams || a.nameBn.localeCompare(b.nameBn));
};

export const getAdmissionUnitsForSelection = (
  catalog: AdmissionCatalog,
  filters: {
    groupSlug?: string;
    examType?: AdmissionExamType;
    universityId: string;
  }
): AdmissionUnitSummary[] => {
  const bySlug = new Map<string, AdmissionUnitSummary>();

  for (const exam of filterAdmissionExams(catalog, filters)) {
    if (!exam.unit) continue;
    const existing = bySlug.get(exam.unit.slug);
    if (existing) {
      existing.examCount += 1;
    } else {
      bySlug.set(exam.unit.slug, { ...exam.unit, examCount: 1 });
    }
  }

  return Array.from(bySlug.values()).sort((a, b) =>
    a.nameBn.localeCompare(b.nameBn)
  );
};

const timeValue = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const getAdmissionExamAvailability = (
  exam: Pick<AdmissionExam, 'isPublished' | 'startTime' | 'endTime'>,
  now: number = Date.now()
): 'available' | 'not-started' | 'closed' | 'unpublished' => {
  if (!exam.isPublished) return 'unpublished';

  const start = timeValue(exam.startTime);
  if (start !== null && now < start) return 'not-started';

  const end = timeValue(exam.endTime);
  if (end !== null && now > end) return 'closed';

  return 'available';
};

export const sortAdmissionExams = (
  exams: AdmissionExam[],
  examType: AdmissionExamType
): AdmissionExam[] => {
  const copy = [...exams];

  if (examType === 'past-exams') {
    return copy.sort((a, b) => {
      const byYear = (b.year ?? -Infinity) - (a.year ?? -Infinity);
      if (byYear !== 0) return byYear;
      return (
        (timeValue(b.createdAt) ?? 0) - (timeValue(a.createdAt) ?? 0)
      );
    });
  }

  return copy.sort((a, b) => {
    if (a.order !== null || b.order !== null) {
      const byOrder = (a.order ?? Infinity) - (b.order ?? Infinity);
      if (byOrder !== 0) return byOrder;
    }
    const byModelNo = (a.modelTestNo ?? Infinity) - (b.modelTestNo ?? Infinity);
    if (byModelNo !== 0) return byModelNo;
    return (timeValue(a.createdAt) ?? 0) - (timeValue(b.createdAt) ?? 0);
  });
};
