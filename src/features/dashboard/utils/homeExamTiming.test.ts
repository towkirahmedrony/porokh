import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCountdown,
  getHomeExamTiming,
  splitHomeExams,
} from './homeExamTiming';

const NOW = Date.parse('2026-11-26T12:00:00.000Z');
const iso = (offsetMinutes: number) =>
  new Date(NOW + offsetMinutes * 60_000).toISOString();

test('classifies a running paper as live and a finished one as ended', () => {
  assert.equal(
    getHomeExamTiming({ start_time: iso(-10), end_time: iso(20) }, NOW),
    'live'
  );
  assert.equal(
    getHomeExamTiming({ start_time: iso(-40), end_time: iso(-1) }, NOW),
    'ended'
  );
  assert.equal(
    getHomeExamTiming({ start_time: iso(15), end_time: iso(75) }, NOW),
    'upcoming'
  );
});

test('a paper without a full window is never live or upcoming', () => {
  assert.equal(
    getHomeExamTiming({ start_time: null, end_time: iso(60) }, NOW),
    'ended'
  );
  assert.equal(
    getHomeExamTiming({ start_time: iso(10), end_time: null }, NOW),
    'ended'
  );
  assert.equal(
    getHomeExamTiming({ start_time: 'not-a-date', end_time: iso(60) }, NOW),
    'ended'
  );
});

test('live papers come first, sorted by the nearest end', () => {
  const { live, upcoming } = splitHomeExams(
    [
      { id: 'later-live', start_time: iso(-5), end_time: iso(60) },
      { id: 'ended', start_time: iso(-60), end_time: iso(-1) },
      { id: 'upcoming-2', start_time: iso(90), end_time: iso(150) },
      { id: 'nearest-live', start_time: iso(-20), end_time: iso(10) },
      { id: 'upcoming-1', start_time: iso(30), end_time: iso(90) },
    ],
    NOW
  );

  assert.deepEqual(
    live.map((paper) => paper.id),
    ['nearest-live', 'later-live']
  );
  assert.deepEqual(
    upcoming.map((paper) => paper.id),
    ['upcoming-1', 'upcoming-2']
  );
});

test('countdown floors remaining time and clamps at zero', () => {
  assert.equal(formatCountdown(iso(15), NOW), '00:15:00');
  assert.equal(formatCountdown(iso(-5), NOW), '00:00:00');
  assert.equal(formatCountdown(iso(3 * 24 * 60), NOW), '72:00:00');
  assert.equal(formatCountdown(null, NOW), '');
});
