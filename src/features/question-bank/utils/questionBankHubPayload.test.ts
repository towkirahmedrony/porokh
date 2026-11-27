import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseQuestionBankHubPayload } from './questionBankHubPayload';

const admissionPayload = {
  stage: 'admission_prep',
  goal: 'varsity',
  mode: 'admission',
  sections: [
    { kind: 'all_admission', count: 3467 },
    {
      kind: 'track',
      track: 'varsity',
      count: 3431,
      primary: true,
      university_total: 18,
      universities: [
        {
          id: 'ru',
          label_bn: 'রাজশাহী বিশ্ববিদ্যালয়',
          label_en: 'University of Rajshahi',
          short_name: 'RU',
          count: 2192,
        },
      ],
      subjects: [
        { id: 'general_knowledge', label_bn: 'সাধারণ জ্ঞান', label_en: null, count: 1163 },
      ],
    },
    { kind: 'track', track: 'medical', count: 15, primary: false },
  ],
};

test('an admission payload keeps the server order and its numbers', () => {
  const parsed = parseQuestionBankHubPayload(admissionPayload);

  assert.equal(parsed.stage, 'admission_prep');
  assert.equal(parsed.goal, 'varsity');
  assert.equal(parsed.mode, 'admission');
  assert.equal(parsed.sections.length, 3);

  const varsity = parsed.sections[1];
  assert.equal(varsity.kind, 'track');
  if (varsity.kind !== 'track') return;

  assert.equal(varsity.primary, true);
  assert.equal(varsity.universityTotal, 18);
  assert.equal(varsity.universities[0].shortName, 'RU');
  assert.equal(varsity.subjects[0].count, 1163);
});

test('a track without rows still parses, so its empty state can render', () => {
  const parsed = parseQuestionBankHubPayload({
    ...admissionPayload,
    sections: [{ kind: 'track', track: 'medical', count: 0, primary: true }],
  });

  const medical = parsed.sections[0];
  assert.equal(medical.kind, 'track');
  if (medical.kind !== 'track') return;

  assert.equal(medical.count, 0);
  assert.deepEqual(medical.universities, []);
  assert.equal(medical.universityTotal, 0);
});

test('unknown sections and unusable rows are dropped, not rendered', () => {
  const parsed = parseQuestionBankHubPayload({
    stage: 'studying',
    goal: null,
    mode: 'hsc',
    sections: [
      { kind: 'mystery', rows: [] },
      {
        kind: 'hsc_subjects',
        rows: [
          { id: '101', label_bn: 'বাংলা প্রথম পত্র', count: 206 },
          { id: 'broken', label_bn: 'নাম নেই' },
          'not-a-row',
        ],
      },
    ],
  });

  assert.equal(parsed.sections.length, 1);
  const subjects = parsed.sections[0];
  assert.equal(subjects.kind, 'hsc_subjects');
  if (subjects.kind !== 'hsc_subjects') return;
  assert.equal(subjects.rows.length, 1);
  assert.equal(subjects.rows[0].id, '101');
});

test('a malformed payload reads as no bank instead of throwing', () => {
  for (const raw of [null, undefined, 'oops', 42, {}, []]) {
    const parsed = parseQuestionBankHubPayload(raw);
    assert.equal(parsed.mode, null);
    assert.deepEqual(parsed.sections, []);
  }
});

test('a stage or goal the app does not know falls back to null', () => {
  const parsed = parseQuestionBankHubPayload({
    stage: 'graduated',
    goal: 'doctorate',
    mode: 'hsc',
    sections: [],
  });

  assert.equal(parsed.stage, null);
  assert.equal(parsed.goal, null);
  assert.equal(parsed.mode, 'hsc');
});
