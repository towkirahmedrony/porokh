import test from 'node:test';
import assert from 'node:assert/strict';

import { groupQuestionsBySubject } from './admissionExamSections.ts';
import type { Question } from '@/features/exam/types/exam.ts';

const question = (
  id: string,
  subject: { id: string; name_bn: string; name_en: string } | null,
  subjectId: string | null = subject?.id ?? null
): Question =>
  ({
    id,
    subject_id: subjectId,
    subject,
    options: [],
  }) as unknown as Question;

test('questions are grouped by subject in first-appearance order', () => {
  const questions = [
    question('q1', { id: 's-bn', name_bn: 'বাংলা', name_en: 'Bangla' }),
    question('q2', { id: 's-en', name_bn: 'ইংরেজি', name_en: 'English' }),
    question('q3', { id: 's-bn', name_bn: 'বাংলা', name_en: 'Bangla' }),
    question('q4', { id: 's-gk', name_bn: 'সাধারণ জ্ঞান', name_en: 'General Knowledge' }),
    question('q5', { id: 's-en', name_bn: 'ইংরেজি', name_en: 'English' }),
  ];

  const sections = groupQuestionsBySubject(questions);

  assert.deepEqual(
    sections.map((section) => section.nameBn),
    ['বাংলা', 'ইংরেজি', 'সাধারণ জ্ঞান']
  );
  assert.deepEqual(
    sections.map((section) => section.entries.map((entry) => entry.question.id)),
    [['q1', 'q3'], ['q2', 'q5'], ['q4']]
  );
});

test('original attempt numbering is preserved after regrouping', () => {
  const questions = [
    question('q1', { id: 's-bn', name_bn: 'বাংলা', name_en: 'Bangla' }),
    question('q2', { id: 's-en', name_bn: 'ইংরেজি', name_en: 'English' }),
    question('q3', { id: 's-bn', name_bn: 'বাংলা', name_en: 'Bangla' }),
  ];

  const sections = groupQuestionsBySubject(questions);
  const english = sections.find((section) => section.nameEn === 'English');

  assert.ok(english);
  assert.equal(english.entries[0].index, 1);
});

test('questions without subject metadata fall into one fallback section', () => {
  const sections = groupQuestionsBySubject([
    question('q1', null),
    question('q2', null, 's-orphan'),
    question('q3', null),
  ]);

  assert.equal(sections.length, 2);
  assert.equal(sections[0].subjectId, null);
  assert.equal(sections[0].nameBn, null);
  assert.deepEqual(
    sections[0].entries.map((entry) => entry.question.id),
    ['q1', 'q3']
  );
  assert.equal(sections[1].subjectId, 's-orphan');
});

test('an empty attempt yields no sections', () => {
  assert.deepEqual(groupQuestionsBySubject([]), []);
});
