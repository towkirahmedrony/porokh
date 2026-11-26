import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatAttemptDate,
  formatClockTime,
  formatDecimal,
  formatDuration,
  formatPercent,
  formatScoreParts,
  resolveDayGroup,
} from './attemptFormat';

test('fractional scores keep up to two decimals and drop trailing zeros', () => {
  assert.deepEqual(formatScoreParts(0.75, 20, 'bn'), { score: '০.৭৫', total: '২০' });
  assert.deepEqual(formatScoreParts(2.75, 30, 'bn'), { score: '২.৭৫', total: '৩০' });
  assert.deepEqual(formatScoreParts(2.5, 30, 'bn'), { score: '২.৫', total: '৩০' });
  assert.deepEqual(formatScoreParts(0, 60, 'bn'), { score: '০', total: '৬০' });
});

test('scores never show three decimals', () => {
  assert.equal(formatDecimal(0.755, 'bn'), '০.৭৬');
  assert.equal(formatDecimal(0.751, 'bn'), '০.৭৫');
  assert.equal(formatDecimal(-0.25, 'bn'), '-০.২৫');
});

test('English keeps Latin digits when the UI language is English', () => {
  assert.equal(formatDecimal(0.75, 'en'), '0.75');
  assert.equal(formatPercent(3.75, 'en'), '3.8%');
});

test('accuracy shows one decimal below ten percent', () => {
  assert.equal(formatPercent(3.75, 'bn'), '৩.৮%');
  assert.equal(formatPercent(62.5, 'bn'), '৬৩%');
  assert.equal(formatPercent(0, 'bn'), '০%');
});

test('duration reads as minutes and seconds in Bengali', () => {
  assert.equal(formatDuration(871, 'bn'), '১৪ মিনিট ৩১ সেকেন্ড');
  assert.equal(formatDuration(52, 'bn'), '৫২ সেকেন্ড');
  assert.equal(formatDuration(3720, 'bn'), '১ ঘণ্টা ২ মিনিট');
  assert.equal(formatDuration(0, 'bn'), '০ সেকেন্ড');
});

test('attempt date uses the Dhaka clock and the Bengali period of day', () => {
  // 2026-11-08T19:10:26Z is 01:10 on 9 November in Dhaka.
  assert.equal(
    formatAttemptDate('2026-11-08T19:10:26.576Z', 'bn'),
    '৯ নভেম্বর ২০২৬ · রাত ১:১০'
  );
  assert.equal(
    formatClockTime('2026-11-08T19:10:26.576Z', 'bn'),
    'রাত ১:১০'
  );
  assert.equal(
    formatClockTime('2026-11-08T05:00:00.000Z', 'bn'),
    'সকাল ১১:০০'
  );
});

test('day groups follow the Dhaka calendar', () => {
  const now = new Date('2026-11-26T10:00:00.000Z'); // 16:00 in Dhaka.
  assert.equal(resolveDayGroup('2026-11-26T02:00:00.000Z', now), 'today');
  assert.equal(resolveDayGroup('2026-11-25T02:00:00.000Z', now), 'yesterday');
  assert.equal(resolveDayGroup('2026-11-21T02:00:00.000Z', now), 'week');
  assert.equal(resolveDayGroup('2026-10-30T02:00:00.000Z', now), 'earlier');
});
