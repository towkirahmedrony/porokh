import test from 'node:test';
import assert from 'node:assert/strict';

import { buildQuestionReportData, resolveQuestionReportText } from './questionReport.ts';
import type { Question } from '../types/exam.ts';

const question = (overrides: Partial<Question> = {}): Question =>
  ({
    id: 'question-1',
    body: null,
    options: [],
    ...overrides,
  }) as Question;

test('report data uses the localized question body, never the raw id', () => {
  const data = buildQuestionReportData(
    question({
      body: {
        text_bn: 'নিচের কোনটি সঠিক?',
        text_en: 'Which one is correct?',
      },
    }),
    'bn'
  );

  assert.equal(data.questionId, 'question-1');
  assert.equal(data.questionText, 'নিচের কোনটি সঠিক?');
  assert.notEqual(data.questionText, data.questionId);
});

test('the active language wins and the other language is the fallback', () => {
  const bilingual = question({
    body: { text_bn: 'বাংলা প্রশ্ন', text_en: 'English question' },
  });

  assert.equal(resolveQuestionReportText(bilingual, 'en'), 'English question');

  const banglaOnly = question({ body: { text_bn: 'শুধু বাংলা' } });
  assert.equal(resolveQuestionReportText(banglaOnly, 'en'), 'শুধু বাংলা');
});

test('legacy string and top-level text fields are supported', () => {
  assert.equal(resolveQuestionReportText(question({ body: 'পুরনো প্রশ্ন' }), 'bn'), 'পুরনো প্রশ্ন');
  assert.equal(resolveQuestionReportText(question({ text: 'Top level' }), 'en'), 'Top level');
});

test('report data carries localized options, rich text and the question image', () => {
  const data = buildQuestionReportData(
    question({
      body: { text_bn: 'প্রশ্ন', text_en: 'Question' },
      image_url: 'https://example.test/question.png',
      options: [
        { id: 'a', text: 'ক', text_bn: 'ক', text_en: 'A', isCorrect: false },
        { id: 'b', text: 'খ', text_bn: 'খ', text_en: 'B', isCorrect: true },
      ],
    }),
    'en'
  );

  assert.equal(data.questionText, 'Question');
  assert.equal(data.imageUrl, 'https://example.test/question.png');
  assert.deepEqual(data.questionOptions, [
    { id: 'a', text: 'A' },
    { id: 'b', text: 'B' },
  ]);
});

test('an exam context is carried into the support form', () => {
  const data = buildQuestionReportData(question(), 'bn', 'exam-42');

  assert.equal(data.examId, 'exam-42');
  assert.equal(buildQuestionReportData(question(), 'bn').examId, undefined);
});

test('missing question content stays empty so the modal can show a safe fallback', () => {
  const data = buildQuestionReportData(question(), 'bn');

  assert.equal(data.questionText, '');
  assert.deepEqual(data.questionOptions, []);
  assert.equal(data.imageUrl, null);
});
