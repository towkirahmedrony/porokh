import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAdmissionCatalog,
  filterAdmissionExams,
  getAdmissionExamAvailability,
  getAdmissionUniversities,
  getAdmissionUnitsForSelection,
  normalizeGroupSlug,
  normalizeUnitSlug,
  parseAdmissionExamType,
  sortAdmissionExams,
} from './admissionAdapter.ts';
import type {
  AdmissionExamPaperRow,
  AdmissionInstitutionRow,
} from '../types/admission.ts';

const institutions: AdmissionInstitutionRow[] = [
  {
    id: 'du-id',
    name_bn: 'ঢাকা বিশ্ববিদ্যালয়',
    name_en: 'University of Dhaka',
    short_name: 'DU',
    slug: 'dhaka-university',
    code: 'DU',
    aliases: ['ঢাবি', 'DU'],
    location: 'Dhaka',
    district: 'Dhaka',
    display_order: 1,
    type: 'admission',
    is_active: true,
  },
  {
    id: 'buet-id',
    name_bn: 'বুয়েট',
    name_en: 'BUET',
    short_name: 'BUET',
    slug: 'buet',
    code: 'BUET',
    aliases: [],
    location: 'Dhaka',
    district: 'Dhaka',
    display_order: 2,
    type: 'admission',
    is_active: true,
  },
];

const paper = (
  id: string,
  title: string,
  meta: Record<string, unknown>,
  overrides: Partial<AdmissionExamPaperRow> = {}
): AdmissionExamPaperRow => ({
  id,
  title,
  subject_id: null,
  category: 'admission',
  exam_type: null,
  meta_data: meta,
  is_published: true,
  is_premium: false,
  duration_min: 60,
  total_marks: 100,
  pass_mark: 40,
  default_negative_marks: 0.25,
  start_time: null,
  end_time: null,
  created_at: '2026-01-01T00:00:00.000Z',
  subjects: null,
  ...overrides,
});

const papers: AdmissionExamPaperRow[] = [
  paper('model-a', 'ঢাকা বিশ্ববিদ্যালয় মডেল টেস্ট ১', {
    group: 'science',
    university_slug: 'dhaka-university',
    unit: 'A',
    model_test_no: 1,
    exam_type: 'model_test',
    order: 1,
  }),
  paper('model-b', 'ঢাকা বিশ্ববিদ্যালয় মডেল টেস্ট ২', {
    group: 'বিজ্ঞান',
    university: 'University of Dhaka',
    unit_slug: 'kha',
    model_test_no: 2,
    exam_type: 'model_test',
    order: 2,
  }),
  paper('past-2023', 'ঢাকা বিশ্ববিদ্যালয় ভর্তি পরীক্ষা ২০২৩', {
    group: 'science',
    university_slug: 'dhaka-university',
    unit: 'A',
    year: 2023,
  }),
  paper('past-2022', 'ঢাকা বিশ্ববিদ্যালয় ভর্তি পরীক্ষা ২০২২', {
    group: 'science',
    university_slug: 'dhaka-university',
    unit: 'ক',
    year: 2022,
  }),
  paper('arts-2021', 'ঢাকা বিশ্ববিদ্যালয় কলা ভর্তি ২০২১', {
    group: 'arts',
    university_slug: 'dhaka-university',
    year: 2021,
  }),
  paper('no-university', 'মডেল টেস্ট', {
    group: 'commerce',
    model_test_no: 3,
    exam_type: 'model_test',
  }),
  paper('no-group', 'বিশ্ববিদ্যালয় ভর্তি', {
    university_id: 'buet-id',
    year: 2020,
  }),
];

const questionCounts = new Map([
  ['model-a', 30],
  ['past-2023', 50],
]);

const catalog = buildAdmissionCatalog(papers, institutions, questionCounts);

test('canonical groups are present and counts only include tagged exams', () => {
  const science = catalog.groups.find((group) => group.slug === 'science');
  const arts = catalog.groups.find((group) => group.slug === 'arts');
  const commerce = catalog.groups.find((group) => group.slug === 'commerce');

  assert.ok(science);
  assert.ok(arts);
  assert.ok(commerce);

  assert.equal(science.examCounts['model-test'], 2);
  assert.equal(science.examCounts['past-exams'], 2);
  assert.equal(arts.examCounts['past-exams'], 1);
  assert.equal(commerce.examCounts['model-test'], 1);
  assert.equal(commerce.examCounts['past-exams'], 0);
});

test('Bangla group and unit metadata are normalised for routing', () => {
  assert.equal(normalizeGroupSlug('বিজ্ঞান'), 'science');
  assert.equal(normalizeGroupSlug('ব্যবসায় শিক্ষা'), 'commerce');
  assert.equal(normalizeGroupSlug('Humanities'), 'arts');
  assert.equal(normalizeUnitSlug('ক'), 'ka');
  assert.equal(normalizeUnitSlug('Unit A'), 'ka');
  assert.equal(normalizeUnitSlug('B'), 'kha');
});

test('a university with several units appears only once', () => {
  const universities = getAdmissionUniversities(catalog, {
    groupSlug: 'science',
    examType: 'model-test',
  });

  assert.equal(universities.length, 1);
  assert.equal(universities[0].id, 'du-id');
  assert.equal(universities[0].totalExams, 2);
});

test('units are derived from the current group and exam type only', () => {
  const units = getAdmissionUnitsForSelection(catalog, {
    groupSlug: 'science',
    examType: 'past-exams',
    universityId: 'du-id',
  });

  assert.equal(units.length, 1);
  assert.equal(units[0].slug, 'ka');
  assert.equal(units[0].examCount, 2);
});

test('filtering by unit returns only that unit exam set', () => {
  const exams = filterAdmissionExams(catalog, {
    groupSlug: 'science',
    examType: 'model-test',
    universityId: 'du-id',
    unitSlug: 'ka',
  });

  assert.deepEqual(
    exams.map((exam) => exam.id).sort(),
    ['model-a']
  );
});

test('historical exams sort newest year first and models honour order', () => {
  const past = filterAdmissionExams(catalog, {
    groupSlug: 'science',
    examType: 'past-exams',
    universityId: 'du-id',
  });

  assert.deepEqual(
    sortAdmissionExams(past, 'past-exams').map((exam) => exam.year),
    [2023, 2022]
  );

  const models = filterAdmissionExams(catalog, {
    groupSlug: 'science',
    examType: 'model-test',
    universityId: 'du-id',
  });

  assert.deepEqual(
    sortAdmissionExams(models, 'model-test').map((exam) => exam.modelTestNo),
    [1, 2]
  );
});

test('question counts are attached only when the database provides them', () => {
  const withCount = catalog.exams.find((exam) => exam.id === 'model-a');
  const withoutCount = catalog.exams.find((exam) => exam.id === 'model-b');

  assert.equal(withCount?.questionCount, 30);
  assert.equal(withoutCount?.questionCount, null);
});

test('university matching works by id, slug, English and Bangla name', () => {
  const bySlug = catalog.exams.find((exam) => exam.id === 'model-a');
  const byEnglishName = catalog.exams.find((exam) => exam.id === 'model-b');
  const byId = catalog.exams.find((exam) => exam.id === 'no-group');

  assert.equal(bySlug?.universityId, 'du-id');
  assert.equal(byEnglishName?.universityId, 'du-id');
  assert.equal(byId?.universityId, 'buet-id');
});

test('papers missing group, university or type are reported, not invented', () => {
  assert.equal(catalog.diagnostics.totalPapers, papers.length);
  assert.equal(catalog.diagnostics.missingGroup, 1);
  assert.equal(catalog.diagnostics.missingUniversity, 1);
  assert.equal(catalog.diagnostics.missingExamType, 0);
});

test('availability follows the published flag and exam window', () => {
  const now = Date.parse('2026-06-01T12:00:00.000Z');

  assert.equal(
    getAdmissionExamAvailability(
      { isPublished: true, startTime: null, endTime: null },
      now
    ),
    'available'
  );

  assert.equal(
    getAdmissionExamAvailability(
      {
        isPublished: true,
        startTime: '2026-06-02T00:00:00.000Z',
        endTime: null,
      },
      now
    ),
    'not-started'
  );

  assert.equal(
    getAdmissionExamAvailability(
      {
        isPublished: true,
        startTime: null,
        endTime: '2026-05-01T00:00:00.000Z',
      },
      now
    ),
    'closed'
  );

  assert.equal(
    getAdmissionExamAvailability(
      { isPublished: false, startTime: null, endTime: null },
      now
    ),
    'unpublished'
  );
});

test('URL exam type values are validated', () => {
  assert.equal(parseAdmissionExamType('model-test'), 'model-test');
  assert.equal(parseAdmissionExamType('past_exams'), 'past-exams');
  assert.equal(parseAdmissionExamType('unknown'), null);
  assert.equal(parseAdmissionExamType(undefined), null);
});
