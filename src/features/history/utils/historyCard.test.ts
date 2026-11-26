import test from 'node:test';
import assert from 'node:assert/strict';
import type { HistoryItem } from '../types/history';
import {
  buildHistoryCard,
  filterAndSortHistory,
  groupHistoryByDay,
  resolveHistoryTitle,
} from './historyCard';

const t = (key: string, values?: Record<string, string | number>) => {
  const template = key.replace('history.', '').replace('practice.', '');
  if (!values) return template;
  return Object.entries(values).reduce(
    (output, [name, value]) => output.replace(`{${name}}`, String(value)),
    template
  );
};

const baseItem: HistoryItem = {
  id: 'attempt-1',
  exam_id: null,
  score: 0.75,
  total_marks: 20,
  correct_count: 1,
  wrong_count: 1,
  skipped_count: 18,
  submitted_at: '2026-11-08T19:10:26.576Z',
  subjects: [{ name_bn: 'বাংলা প্রথম পত্র', name_en: 'Bangla 1st Paper' }],
};

test('a legacy attempt with no exam title uses its stored subject, not undefined', () => {
  const card = buildHistoryCard(baseItem, 'bn', t as never);

  assert.equal(card.title, 'বাংলা প্রথম পত্র');
  assert.equal(card.meta, '৯ নভেম্বর ২০২৬ · রাত ১:১০');
  assert.equal(card.scoreText, '০.৭৫');
  assert.equal(card.totalText, '২০');
});

test('a paper title wins over the subject and is not repeated in the meta', () => {
  const card = buildHistoryCard(
    { ...baseItem, exam_title: '[টেস্ট] বাংলা মডেল টেস্ট' },
    'bn',
    t as never
  );

  assert.equal(card.title, '[টেস্ট] বাংলা মডেল টেস্ট');
  assert.equal(card.meta, 'বাংলা প্রথম পত্র · ৯ নভেম্বর ২০২৬ · রাত ১:১০');
});

test('an all-skipped attempt has a neutral proportion bar', () => {
  const card = buildHistoryCard(
    {
      ...baseItem,
      score: 0,
      total_marks: 60,
      correct_count: 0,
      wrong_count: 0,
      skipped_count: 60,
    },
    'bn',
    t as never
  );

  assert.deepEqual(card.segments, [0, 0, 100]);
  assert.equal(card.counts.total, 60);
  assert.equal(card.summary, 'skippedCount');
});

test('practice attempts get a badge and their own fallback title', () => {
  const card = buildHistoryCard(
    {
      ...baseItem,
      practice_mode: 'retake',
      source_history_id: 'source-1',
      subjects: [],
    },
    'bn',
    t as never
  );

  assert.equal(card.badge, 'retake');
  assert.equal(card.title, 'retakeTitle');
});

test('a matched title is found by its subject in either language', () => {
  const english = resolveHistoryTitle(baseItem, 'en', t as never);
  assert.equal(english.title, 'Bangla 1st Paper');

  const matched = filterAndSortHistory(
    [baseItem],
    'bangla 1st',
    'newest',
    'en',
    t as never
  );
  assert.equal(matched.length, 1);
});

test('sorting puts the newest attempt first by default order argument', () => {
  const older: HistoryItem = {
    ...baseItem,
    id: 'old',
    submitted_at: '2026-10-19T05:29:49.621Z',
  };

  const newest = filterAndSortHistory([older, baseItem], '', 'newest', 'bn', t as never);
  assert.deepEqual(
    newest.map((item) => item.id),
    ['attempt-1', 'old']
  );

  const oldest = filterAndSortHistory([older, baseItem], '', 'oldest', 'bn', t as never);
  assert.deepEqual(
    oldest.map((item) => item.id),
    ['old', 'attempt-1']
  );
});

test('day groups keep today before earlier attempts', () => {
  const now = new Date('2026-11-26T10:00:00.000Z');
  const groups = groupHistoryByDay(
    [
      { id: 'old', iso: '2026-10-19T05:29:49.621Z' },
      { id: 'today', iso: '2026-11-26T02:00:00.000Z' },
      { id: 'yesterday', iso: '2026-11-25T02:00:00.000Z' },
    ],
    (item) => item.iso,
    now
  );

  assert.deepEqual(
    groups.map((group) => group.key),
    ['today', 'yesterday', 'earlier']
  );
});
