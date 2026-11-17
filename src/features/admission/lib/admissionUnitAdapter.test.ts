import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildUniversityUnits,
  hasUnitContent,
  mapUnitContent,
  sessionYear,
  toAdmissionExam,
  type RawAdmissionInstitutionRow,
  type RawAdmissionUnitRow,
} from './admissionUnitAdapter.ts';

const institutions: RawAdmissionInstitutionRow[] = [
  {
    id: 'du',
    name_bn: 'ঢাকা বিশ্ববিদ্যালয়',
    name_en: 'University of Dhaka',
    short_name: 'DU',
    slug: 'du',
    location: 'Dhaka',
    district: 'Dhaka',
    is_active: true,
  },
  {
    id: 'buet',
    name_bn: 'বুয়েট',
    name_en: 'BUET',
    short_name: 'BUET',
    slug: 'buet',
    location: 'Dhaka',
    district: 'Dhaka',
    is_active: true,
  },
  {
    id: 'inactive',
    name_bn: 'নিষ্ক্রিয়',
    name_en: 'Inactive University',
    short_name: null,
    slug: 'inactive',
    location: null,
    district: null,
    is_active: false,
  },
];

const unit = (
  id: string,
  institutionId: string,
  nameBn: string,
  overrides: Partial<RawAdmissionUnitRow> = {}
): RawAdmissionUnitRow => ({
  id,
  institution_id: institutionId,
  name_bn: nameBn,
  name_en: null,
  code: 'A',
  display_order: 0,
  is_active: true,
  ...overrides,
});

const units: RawAdmissionUnitRow[] = [
  unit('du-a', 'du', 'ক ইউনিট', { code: 'A', display_order: 1 }),
  unit('du-b', 'du', 'খ ইউনিট', { code: 'B', display_order: 2 }),
  unit('buet-a', 'buet', 'এ ইউনিট'),
  unit('inactive-unit', 'du', 'নিষ্ক্রিয় ইউনিট', { is_active: false }),
  unit('orphan', 'missing-university', 'অনাথ ইউনিট'),
  unit('inactive-university', 'inactive', 'অন্য ইউনিট'),
];

const counts = new Map([
  ['du-a', 3],
  ['du-b', 1],
  ['buet-a', 2],
]);

test('universities are built from active units and their active parent', () => {
  const result = buildUniversityUnits(units, institutions, counts);

  assert.deepEqual(
    result.map((university) => university.id),
    ['du', 'buet']
  );

  const du = result[0];
  assert.equal(du.units.length, 2);
  assert.equal(du.paperCount, 4);
  assert.deepEqual(
    du.units.map((item) => item.id),
    ['du-a', 'du-b']
  );
});

test('inactive units, orphan units and inactive universities are never listed', () => {
  const result = buildUniversityUnits(units, institutions, counts);
  const ids = result.flatMap((university) => university.units.map((item) => item.id));

  assert.ok(!ids.includes('inactive-unit'));
  assert.ok(!ids.includes('orphan'));
  assert.ok(!ids.includes('inactive-university'));
});

test('unit paper counts default to zero instead of undefined', () => {
  const result = buildUniversityUnits(units, institutions, new Map());
  const du = result.find((university) => university.id === 'du');

  assert.equal(du?.paperCount, 0);
  assert.equal(du?.units.every((item) => item.paperCount === 0), true);
});

const rawContent = {
  unit: {
    id: 'du-a',
    institution_id: 'du',
    name_bn: 'ক ইউনিট',
    name_en: 'Unit A',
    code: 'A',
    description: 'বিজ্ঞান ইউনিট',
    display_order: 1,
  },
  university: {
    id: 'du',
    name_bn: 'ঢাকা বিশ্ববিদ্যালয়',
    name_en: 'University of Dhaka',
    short_name: 'DU',
    slug: 'du',
    location: 'Dhaka',
  },
  past_exams: [
    {
      session: '2025-2026',
      papers: [
        {
          id: 'past-2025',
          title: 'ঢাবি ক ইউনিট ২০২৫',
          mode: 'past_exam',
          session: '2025-2026',
          duration_min: 60,
          total_marks: 100,
          question_count: 50,
          is_premium: false,
        },
      ],
    },
    {
      session: null,
      papers: [
        {
          id: 'past-old',
          title: 'পুরোনো প্রশ্ন',
          mode: 'past_exam',
          question_count: 30,
        },
      ],
    },
  ],
  model_tests: [
    {
      id: 'model-1',
      title: 'মডেল টেস্ট ১',
      mode: 'model_test',
      model_test_no: 1,
      duration_min: 60,
      total_marks: 100,
      question_count: 40,
    },
    {
      id: 'model-2',
      title: 'মডেল টেস্ট ২',
      mode: 'model_test',
      model_test_no: 2,
      question_count: 40,
    },
  ],
  subjects: [
    {
      id: 'physics',
      name_bn: 'পদার্থবিজ্ঞান',
      name_en: 'Physics',
      slug: 'physics',
      question_count: 25,
      chapters: [
        { id: 'ch1', name_bn: 'গতিবিদ্যা', name_en: 'Kinematics', question_count: 10 },
        { id: 'ch2', name_bn: 'নিউটনিয়ান বলবিদ্যা', name_en: null, question_count: 15 },
      ],
    },
    {
      id: 'chemistry',
      name_bn: 'রসায়ন',
      name_en: 'Chemistry',
      slug: 'chemistry',
      question_count: 8,
      chapters: [],
    },
  ],
};

test('unit content maps sessions, multi-subject model tests and subjects', () => {
  const content = mapUnitContent(rawContent);

  assert.equal(content.unit.id, 'du-a');
  assert.equal(content.university?.shortName, 'DU');

  assert.deepEqual(
    content.pastExams.map((group) => group.session),
    ['2025-2026', null]
  );
  assert.equal(content.pastExams[0].papers[0].questionCount, 50);

  // Model tests are deliberately not subject-filtered: a unit model test spans
  // several subjects, so both papers must survive the mapping.
  assert.deepEqual(
    content.modelTests.map((paper) => paper.id),
    ['model-1', 'model-2']
  );

  assert.deepEqual(
    content.subjects.map((subject) => [subject.id, subject.questionCount]),
    [
      ['physics', 25],
      ['chemistry', 8],
    ]
  );
  assert.deepEqual(
    content.subjects[0].chapters.map((chapter) => [chapter.id, chapter.questionCount]),
    [
      ['ch1', 10],
      ['ch2', 15],
    ]
  );
});

test('malformed backend entries are dropped rather than rendered', () => {
  const content = mapUnitContent({
    unit: { id: 'du-a', code: 'A' },
    past_exams: [{ session: '2024', papers: [{ title: 'no id' }] }],
    model_tests: [{ id: 42 }],
    subjects: [{ name_bn: 'no id' }],
  });

  assert.deepEqual(content.pastExams, []);
  assert.deepEqual(content.modelTests, []);
  assert.deepEqual(content.subjects, []);
  assert.equal(hasUnitContent(content), false);
});

test('session years power the paper card label', () => {
  assert.equal(sessionYear('2025-2026'), 2025);
  assert.equal(sessionYear('2019'), 2019);
  assert.equal(sessionYear(null), null);
  assert.equal(sessionYear('অন্যান্য'), null);
});

test('a past paper maps onto the shared exam card without inventing data', () => {
  const paper = mapUnitContent(rawContent).pastExams[0].papers[0];
  const exam = toAdmissionExam(paper, 'past-exams');

  assert.equal(exam.id, 'past-2025');
  assert.equal(exam.examType, 'past-exams');
  assert.equal(exam.year, 2025);
  assert.equal(exam.questionCount, 50);
  assert.equal(exam.isPublished, true);
  assert.equal(exam.unit, null);
});
