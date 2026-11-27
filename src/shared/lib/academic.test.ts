import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatAcademicLabel,
  formatBatchLabel,
  formatHeaderStatus,
  formatStudentAcademicLabel,
  goalLabel,
  isAdmissionGoal,
  isStudyGoal,
  type StudyStage,
} from './academic';

test('goal labels are the four the product defines', () => {
  assert.equal(goalLabel('hsc'), 'HSC');
  assert.equal(goalLabel('medical'), 'মেডিকেল');
  assert.equal(goalLabel('engineering'), 'ইঞ্জিনিয়ারিং');
  assert.equal(goalLabel('varsity'), 'ভার্সিটি');
  assert.equal(goalLabel('varsity', 'en'), 'University');
  assert.equal(goalLabel('MBBS'), '');
  assert.equal(goalLabel(null), '');
});

test('only the four known goals and three admission goals are accepted', () => {
  assert.equal(isStudyGoal('hsc'), true);
  assert.equal(isStudyGoal('doctor'), false);
  assert.equal(isAdmissionGoal('hsc'), false);
  assert.equal(isAdmissionGoal('medical'), true);
});

test('a batch label carries the year in Bangla digits', () => {
  assert.equal(formatBatchLabel('2026'), 'HSC ২০২৬ ব্যাচ');
  assert.equal(formatBatchLabel('2026', 'en'), 'HSC 2026 batch');
  assert.equal(formatBatchLabel('26'), null);
  assert.equal(formatBatchLabel(null), null);
});

test('a studying student is labelled an examinee, with the goal only when it is a real one', () => {
  assert.equal(
    formatAcademicLabel({ hsc_batch: '2027', study_goal: null }, 'studying'),
    'HSC ২০২৭ · পরীক্ষার্থী'
  );
  assert.equal(
    formatAcademicLabel({ hsc_batch: '2027', study_goal: 'hsc' }, 'studying'),
    'HSC ২০২৭ · পরীক্ষার্থী'
  );
  assert.equal(
    formatAcademicLabel({ hsc_batch: '2027', study_goal: 'medical' }, 'studying'),
    'HSC ২০২৭ · পরীক্ষার্থী · মেডিকেল প্রস্তুতি'
  );
});

test('an admission student is labelled with the batch and the confirmed goal', () => {
  assert.equal(
    formatAcademicLabel({ hsc_batch: '2026', study_goal: 'varsity' }, 'admission_prep'),
    'HSC ২০২৬ ব্যাচ · ভার্সিটি ভর্তি প্রস্তুতি'
  );
  assert.equal(
    formatAcademicLabel({ hsc_batch: '2026', study_goal: 'engineering' }, 'admission_prep'),
    'HSC ২০২৬ ব্যাচ · ইঞ্জিনিয়ারিং প্রস্তুতি'
  );
});

test('a post-exam student without a goal is asked for one, not called an examinee', () => {
  assert.equal(
    formatAcademicLabel({ hsc_batch: '2026', study_goal: null }, 'post_hsc'),
    'HSC ২০২৬ ব্যাচ · লক্ষ্য ঠিক করো'
  );
});

test('a missing stage reads as studying rather than a guess', () => {
  assert.equal(
    formatAcademicLabel({ hsc_batch: '2027', study_goal: null }, null),
    'HSC ২০২৭ · পরীক্ষার্থী'
  );
});

test('no label ever prints the word শ্রেণি or a raw goal value', () => {
  const labels = [
    formatAcademicLabel({ hsc_batch: '2026', study_goal: 'varsity' }, 'admission_prep'),
    formatAcademicLabel({ hsc_batch: '2027', study_goal: 'medical' }, 'studying'),
    formatAcademicLabel({ hsc_batch: '2026' }, 'post_hsc'),
    formatStudentAcademicLabel({ hsc_batch: '2026', study_goal: 'varsity' }),
  ];

  for (const label of labels) {
    assert.ok(!label.includes('শ্রেণি'), `unexpected class word in "${label}"`);
    assert.ok(!/\bvarsity\b/.test(label), `unexpected raw goal in "${label}"`);
  }
});

test('an admission header is one goal chip and never the batch', () => {
  assert.deepEqual(
    formatHeaderStatus({ hsc_batch: '2026', study_goal: 'varsity' }, 'admission_prep'),
    [{ text: 'ভার্সিটি ভর্তি প্রস্তুতি', kind: 'goal' }]
  );
  assert.deepEqual(
    formatHeaderStatus({ hsc_batch: '2026', study_goal: 'medical' }, 'admission_prep'),
    [{ text: 'মেডিকেল ভর্তি প্রস্তুতি', kind: 'goal' }]
  );
  assert.deepEqual(
    formatHeaderStatus({ hsc_batch: '2026', study_goal: 'engineering' }, 'admission_prep'),
    [{ text: 'ইঞ্জিনিয়ারিং ভর্তি প্রস্তুতি', kind: 'goal' }]
  );
});

test('a studying header leads with the batch and only adds a real goal', () => {
  assert.deepEqual(
    formatHeaderStatus({ hsc_batch: '2027', study_goal: null }, 'studying'),
    [{ text: 'HSC ২০২৭ · পরীক্ষার্থী', kind: 'status' }]
  );
  assert.deepEqual(
    formatHeaderStatus({ hsc_batch: '2027', study_goal: 'medical' }, 'studying'),
    [
      { text: 'HSC ২০২৭ · পরীক্ষার্থী', kind: 'status' },
      { text: 'মেডিকেল প্রস্তুতি', kind: 'goal' },
    ]
  );
  assert.deepEqual(
    formatHeaderStatus({ hsc_batch: '2027', study_goal: 'hsc' }, 'studying'),
    [{ text: 'HSC ২০২৭ · পরীক্ষার্থী', kind: 'status' }]
  );
});

test('a post-exam header waits for the gate instead of guessing', () => {
  assert.deepEqual(
    formatHeaderStatus({ hsc_batch: '2026', study_goal: 'varsity' }, 'post_hsc'),
    []
  );
  assert.deepEqual(formatHeaderStatus({ hsc_batch: '2026' }, 'post_hsc'), []);
});

test('a missing or unknown stage renders nothing, not a stale line', () => {
  assert.deepEqual(formatHeaderStatus({ hsc_batch: '2027' }, null), []);
  assert.deepEqual(formatHeaderStatus({ hsc_batch: '2027' }, undefined), []);
  assert.deepEqual(
    formatHeaderStatus({ hsc_batch: '2027' }, 'graduate' as StudyStage),
    []
  );
});

test('an unknown goal never reaches the screen as a raw value', () => {
  assert.deepEqual(
    formatHeaderStatus({ hsc_batch: '2027', study_goal: 'doctor' }, 'studying'),
    [{ text: 'HSC ২০২৭ · পরীক্ষার্থী', kind: 'status' }]
  );
  assert.deepEqual(
    formatHeaderStatus({ hsc_batch: '2026', study_goal: 'doctor' }, 'admission_prep'),
    [{ text: 'ভর্তি প্রস্তুতি', kind: 'goal' }]
  );

  for (const stage of ['studying', 'admission_prep'] as const) {
    for (const goal of ['doctor', 'varsity', 'MBBS', '']) {
      const texts = formatHeaderStatus({ hsc_batch: '2026', study_goal: goal }, stage).map(
        (chip) => chip.text
      );
      assert.ok(!texts.some((text) => /varsity|doctor|MBBS/i.test(text)), texts.join(' | '));
    }
  }
});

test('a missing or malformed batch produces no broken chip', () => {
  assert.deepEqual(formatHeaderStatus({ hsc_batch: null }, 'studying'), []);
  assert.deepEqual(formatHeaderStatus({ hsc_batch: '26' }, 'studying'), []);
  assert.deepEqual(formatHeaderStatus({}, 'studying'), []);
  assert.deepEqual(
    formatHeaderStatus({ hsc_batch: '2027', study_goal: 'varsity' }, 'studying'),
    [
      { text: 'HSC ২০২৭ · পরীক্ষার্থী', kind: 'status' },
      { text: 'ভার্সিটি ভর্তি প্রস্তুতি', kind: 'goal' },
    ]
  );
  assert.deepEqual(
    formatHeaderStatus({ hsc_batch: null, study_goal: 'medical' }, 'studying'),
    [{ text: 'মেডিকেল প্রস্তুতি', kind: 'goal' }]
  );
});

test('the header follows the app language without changing identity', () => {
  assert.deepEqual(formatHeaderStatus({ hsc_batch: '2027' }, 'studying', 'en'), [
    { text: 'HSC 2027 · Student', kind: 'status' },
  ]);
  assert.deepEqual(
    formatHeaderStatus({ hsc_batch: '2026', study_goal: 'varsity' }, 'admission_prep', 'en'),
    [{ text: 'University admission prep', kind: 'goal' }]
  );
});

test('a long name in the profile cannot leak into or lengthen a chip', () => {
  const longName = 'Towkir Ahmed '.repeat(12).trim();
  const chips = formatHeaderStatus(
    { hsc_batch: '2026', study_goal: 'varsity', full_name: longName } as {
      hsc_batch: string;
      study_goal: string;
    },
    'admission_prep'
  );

  assert.deepEqual(chips, [{ text: 'ভার্সিটি ভর্তি প্রস্তুতি', kind: 'goal' }]);
});

test('another student is described by batch and goal, without a guessed stage', () => {
  assert.equal(
    formatStudentAcademicLabel({ hsc_batch: '2026', study_goal: 'varsity' }),
    'HSC ২০২৬ ব্যাচ · ভার্সিটি'
  );
  assert.equal(formatStudentAcademicLabel({ hsc_batch: null, study_goal: null }), '');
});
