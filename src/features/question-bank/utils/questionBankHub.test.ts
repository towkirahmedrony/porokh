import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  HUB_COLLEGE_LIMIT,
  HUB_COLLEGE_MIN_COUNT,
  HUB_UNIVERSITY_LIMIT,
  findSection,
  hasMoreColleges,
  hubAdmissionSubjectHref,
  hubAllAdmissionHref,
  hubAllCollegesHref,
  hubCollegeRows,
  hubInstitutionHref,
  hubSearchHref,
  hubSubjectHref,
  hubTrackHref,
  hubUniversityHref,
  hubUniversityPageHref,
  hubUniversityRows,
  hubUniversityYearHref,
  isThinTrack,
} from './questionBankHub';
import type { QuestionBankHubPayload, QuestionBankHubRow } from '../types/questionBankHub';

const row = (id: string, count: number, labelBn = id): QuestionBankHubRow => ({
  id,
  labelBn,
  labelEn: null,
  shortName: null,
  count,
});

const payload: QuestionBankHubPayload = {
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
      universities: [row('ru', 2192, 'রাজশাহী বিশ্ববিদ্যালয়')],
      universityTotal: 1,
      subjects: [],
    },
  ],
};

test('the college rows stop at the threshold and the limit', () => {
  const rows = [
    row('a', 2),
    row('b', 11),
    row('c', 3),
    ...Array.from({ length: 10 }, (_, index) => row(`filler-${index}`, 10 + index)),
  ];

  const shown = hubCollegeRows(rows);

  assert.equal(shown.length, HUB_COLLEGE_LIMIT);
  assert.equal(shown[0].count, 19);
  assert.ok(shown.every((item) => item.count >= HUB_COLLEGE_MIN_COUNT));
  // The two-question college is reachable from the full list, not the hub.
  assert.equal(shown.some((item) => item.id === 'a'), false);
});

test('the all-colleges row appears only when something is left out', () => {
  const three = [row('a', 9), row('b', 4), row('c', 3)];
  assert.equal(hasMoreColleges(three), false);

  const withLowCount = [...three, row('d', 1)];
  assert.equal(hasMoreColleges(withLowCount), true);
});

test('universities are capped at six, highest count first', () => {
  const rows = Array.from({ length: 8 }, (_, index) => row(`u-${index}`, index));

  const shown = hubUniversityRows(rows);

  assert.equal(shown.length, HUB_UNIVERSITY_LIMIT);
  assert.equal(shown[0].count, 7);
});

test('a hand-tagged track under fifty questions gets the honest note', () => {
  assert.equal(isThinTrack(15), true);
  assert.equal(isThinTrack(0), false);
  assert.equal(isThinTrack(50), false);
});

test('findSection narrows by kind and tolerates a missing payload', () => {
  assert.equal(findSection(payload, 'all_admission')?.count, 3467);
  assert.equal(findSection(payload, 'hsc_subjects'), null);
  assert.equal(findSection(undefined, 'all_admission'), null);
});

test('every href is a list deep link with the filter that produced the count', () => {
  assert.equal(hubSubjectHref('101'), '/question-bank/list?level=hsc&subject=101');
  assert.equal(
    hubInstitutionHref('board-9'),
    '/question-bank/list?level=hsc&institutionId=board-9'
  );
  assert.equal(
    hubTrackHref('medical'),
    '/question-bank/list?level=admission&track=medical'
  );
  assert.equal(
    hubAllAdmissionHref(),
    '/question-bank/list?level=admission&allTracks=1'
  );
  assert.equal(
    hubAdmissionSubjectHref('general_knowledge'),
    '/question-bank/list?level=admission&allTracks=1&subject=general_knowledge'
  );
  assert.equal(
    hubUniversityHref('ru'),
    '/question-bank/list?level=admission&allTracks=1&university=ru'
  );
  assert.equal(hubUniversityPageHref('ru'), '/question-bank/university/ru');
  assert.equal(hubAllCollegesHref(), '/question-bank/colleges');
  assert.equal(hubSearchHref('hsc'), '/question-bank/list?level=hsc&view=list');
});

test('a university year keeps the unit it was counted under', () => {
  assert.equal(
    hubUniversityYearHref('ru', 'unit-a', '2022-23'),
    '/question-bank/list?level=admission&allTracks=1&university=ru&unit=unit-a&year=2022-23'
  );
  assert.equal(
    hubUniversityYearHref('ru', '', '2022-23'),
    '/question-bank/list?level=admission&allTracks=1&university=ru&year=2022-23'
  );
});
