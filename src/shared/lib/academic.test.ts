import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatAcademicLabel,
  formatBatchLabel,
  formatStudentAcademicLabel,
  goalLabel,
  isAdmissionGoal,
  isStudyGoal,
} from './academic';

test('goal labels are the four the product defines', () => {
  assert.equal(goalLabel('hsc'), 'এইচএসসি');
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

test('another student is described by batch and goal, without a guessed stage', () => {
  assert.equal(
    formatStudentAcademicLabel({ hsc_batch: '2026', study_goal: 'varsity' }),
    'HSC ২০২৬ ব্যাচ · ভার্সিটি'
  );
  assert.equal(formatStudentAcademicLabel({ hsc_batch: null, study_goal: null }), '');
});
