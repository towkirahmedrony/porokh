import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMonthGrid,
  buildTopicPracticeHref,
  dhakaTodayKey,
  filterTrend,
  formatCount,
  formatDayLabel,
  formatPercent,
  formatShortDayLabel,
  monthLabel,
  parseDateKey,
  shiftMonth,
  weekdayLabels,
} from './progressView';

test('November 2026 starts on Sunday and needs five rows', () => {
  const weeks = buildMonthGrid(2026, 10, { '2026-11-08': 1, '2026-11-09': 3 });

  assert.equal(weeks.length, 5);
  assert.equal(weeks[0][0]?.date, '2026-11-01');
  assert.equal(weeks[0][0]?.day, 1);
  assert.equal(weeks[1][0]?.date, '2026-11-08');
  assert.equal(weeks[1][0]?.count, 1);
  assert.equal(weeks[1][1]?.count, 3);
  assert.equal(weeks[4][0]?.day, 29);
  assert.equal(weeks[4][1]?.day, 30);
  assert.equal(weeks[4][2], null);
});

test('February 2024 keeps its leap day and pads the first week', () => {
  const weeks = buildMonthGrid(2024, 1, {});

  assert.equal(weeks[0][0], null);
  assert.equal(weeks[0][3], null);
  assert.equal(weeks[0][4]?.day, 1);

  const days = weeks.flat().filter((cell) => cell !== null);
  assert.equal(days.length, 29);
  assert.equal(days[days.length - 1]?.date, '2024-02-29');
});

test('a 31-day month starting Saturday needs six rows', () => {
  const weeks = buildMonthGrid(2026, 7, {});

  assert.equal(weeks.length, 6);
  assert.equal(weeks[0][6]?.day, 1);
  assert.equal(weeks[5][0]?.day, 30);
  assert.equal(weeks[5][1]?.day, 31);
  assert.equal(weeks[5][2], null);
});

test('month navigation crosses the year in both directions', () => {
  assert.deepEqual(shiftMonth(2026, 11, 1), { year: 2027, month: 0 });
  assert.deepEqual(shiftMonth(2026, 0, -1), { year: 2025, month: 11 });
  assert.deepEqual(shiftMonth(2026, 10, 0), { year: 2026, month: 10 });
});

test('the Dhaka day is not the UTC day late at night', () => {
  assert.equal(dhakaTodayKey(new Date('2026-11-25T20:30:00Z')), '2026-11-26');
  assert.equal(dhakaTodayKey(new Date('2026-11-25T10:00:00Z')), '2026-11-25');
});

test('date keys round-trip and reject junk', () => {
  assert.deepEqual(parseDateKey('2026-11-08'), { year: 2026, month: 10, day: 8 });
  assert.equal(parseDateKey('2026-13-01'), null);
  assert.equal(parseDateKey('08/11/2026'), null);
});

test('percentage formatting is honest about missing data', () => {
  assert.equal(formatPercent(null, 'bn'), '—');
  assert.equal(formatPercent(undefined, 'en'), '—');
  assert.equal(formatPercent(Number.NaN, 'bn'), '—');
  assert.equal(formatPercent(2.17, 'bn'), '২.২%');
  assert.equal(formatPercent(2.17, 'en'), '2.2%');
  assert.equal(formatPercent(57.4, 'bn'), '৫৭%');
  assert.equal(formatPercent(0, 'bn'), '০%');
});

test('counts are localized', () => {
  assert.equal(formatCount(153, 'bn'), '১৫৩');
  assert.equal(formatCount(0, 'en'), '0');
  assert.equal(formatCount(null, 'bn'), '—');
});

test('trend ranges keep the last points in ascending order', () => {
  const points = Array.from({ length: 40 }, (_, index) => ({
    date: `2026-10-${index + 1}`,
    iso: '',
    score_pct: index,
  }));

  assert.equal(filterTrend(points, 'all').length, 40);
  assert.equal(filterTrend(points, '30').length, 30);
  assert.equal(filterTrend(points, '7').length, 7);
  assert.equal(filterTrend(points, '7')[0].score_pct, 33);
  assert.equal(filterTrend(points.slice(0, 2), '7').length, 2);
});

test('the practice link carries the real topic filter', () => {
  assert.equal(
    buildTopicPracticeHref('sub-1', 'topic 2'),
    '/question-bank?subject=sub-1&topic=topic%202'
  );
});

test('day labels are Dhaka dates in both lengths', () => {
  assert.equal(formatDayLabel('2026-11-08', 'bn'), '৮ নভেম্বর');
  assert.equal(formatDayLabel('2026-11-08', 'en'), '8 November');
  assert.match(formatShortDayLabel('2026-11-08', 'bn'), /৮\s?নভে/);
  assert.equal(formatDayLabel('not-a-date', 'en'), 'not-a-date');
});

test('month and weekday labels follow the language', () => {
  assert.match(monthLabel(2026, 10, 'bn'), /নভেম্বর/);
  assert.match(monthLabel(2026, 10, 'en'), /November/);
  assert.equal(weekdayLabels('en').length, 7);
  assert.match(weekdayLabels('bn')[0], /রবি/);
});
