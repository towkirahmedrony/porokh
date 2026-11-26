import test from 'node:test';
import assert from 'node:assert/strict';

import { getMarksPerQuestion, syncInstructionMarks } from './paperMarks.ts';

test('per-question marks are derived from the paper total and question count', () => {
  assert.equal(getMarksPerQuestion({ total_marks: 100, question_count: 80 }), 1.25);
  assert.equal(getMarksPerQuestion({ total_marks: 100, question_count: 100 }), 1);
  assert.equal(getMarksPerQuestion({ total_marks: 96.25, question_count: 77 }), 1.25);
});

test('missing or invalid paper values do not produce a per-question mark', () => {
  assert.equal(getMarksPerQuestion({ total_marks: null, question_count: 80 }), null);
  assert.equal(getMarksPerQuestion({ total_marks: 100, question_count: null }), null);
  assert.equal(getMarksPerQuestion({ total_marks: 0, question_count: 80 }), null);
  assert.equal(getMarksPerQuestion({ total_marks: 100, question_count: 0 }), null);
});

test('the Bengali instruction claim follows the paper instead of a fixed 1 mark', () => {
  assert.equal(
    syncInstructionMarks(
      'প্রতিটি প্রশ্নের ১ নম্বর। প্রতিটি ভুল উত্তরের জন্য ০.২৫ নম্বর কাটা যাবে। সময় ১ ঘণ্টা।',
      1.25,
      'bn'
    ),
    'প্রতিটি প্রশ্নের ১.২৫ নম্বর। প্রতিটি ভুল উত্তরের জন্য ০.২৫ নম্বর কাটা যাবে। সময় ১ ঘণ্টা।'
  );

  assert.equal(
    syncInstructionMarks('প্রশ্ন ৮০টি · প্রতিটি প্রশ্নের মান ১ · সময় ১ ঘণ্টা।', 1.25, 'bn'),
    'প্রশ্ন ৮০টি · প্রতিটি প্রশ্নের মান ১.২৫ · সময় ১ ঘণ্টা।'
  );

  assert.equal(
    syncInstructionMarks('প্রতিটি প্রশ্নের জন্য এক নম্বর; সময় ১ ঘণ্টা।', 1.25, 'bn'),
    'প্রতিটি প্রশ্নের জন্য ১.২৫ নম্বর; সময় ১ ঘণ্টা।'
  );
});

test('the English instruction claim follows the paper as well', () => {
  assert.equal(
    syncInstructionMarks(
      'Each question carries 1 mark. 0.25 marks will be deducted for each wrong answer.',
      1.25,
      'en'
    ),
    'Each question carries 1.25 marks. 0.25 marks will be deducted for each wrong answer.'
  );

  assert.equal(
    syncInstructionMarks('One mark for each correct answer; 0.25 deducted for a wrong one.', 1.25, 'en'),
    '1.25 marks for each correct answer; 0.25 deducted for a wrong one.'
  );

  assert.equal(
    syncInstructionMarks('1 mark per question. 0.25 marks for each wrong answer.', 1.25, 'en'),
    '1.25 marks per question. 0.25 marks for each wrong answer.'
  );
});

test('already-correct instructions are left unchanged', () => {
  const text = 'প্রশ্ন ৮০টি · সময় ১ ঘণ্টা · প্রতিটি প্রশ্নের মান ১.২৫ · প্রতিটি ভুল উত্তরে ০.২৫ নম্বর কাটা যাবে।';
  assert.equal(syncInstructionMarks(text, 1.25, 'bn'), text);
});
