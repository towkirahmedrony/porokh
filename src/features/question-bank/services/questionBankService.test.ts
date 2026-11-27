import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildQuestionBankV3Args } from './questionBankRequest';
import { describeQuestionBankError } from './questionBankErrors';
import {
  withAdmissionDefaults,
  filtersFromSearchParams,
} from '../utils/questionBankUrlState';

const parse = (search: string) => new URLSearchParams(search);

test('the first admission request carries the stage level and the goal track', () => {
  // What the screen sends on its first render once the server's stage is known:
  // no subject, no search, no filter, just the tab and the goal.
  const filters = withAdmissionDefaults(filtersFromSearchParams(parse('')), 'varsity');
  const args = buildQuestionBankV3Args(filters, 0, 20);

  assert.equal(args.p_level, 'admission');
  assert.equal(args.p_track, 'varsity');
  assert.equal(args.p_include_other_admission_tracks, false);
  assert.equal(args.p_subject_id, null);
  assert.equal(args.p_search, null);
  assert.equal(args.p_limit, 20);
  assert.equal(args.p_offset, 0);
});

test('the "all admission questions" chip sends no track and asks for every track', () => {
  const filters = {
    ...withAdmissionDefaults(filtersFromSearchParams(parse('')), 'medical'),
    allTracks: true,
  };
  const args = buildQuestionBankV3Args(filters, 20, 20);

  assert.equal(args.p_track, 'medical');
  assert.equal(args.p_include_other_admission_tracks, true);
  assert.equal(args.p_offset, 20);
});

test('an empty filter string is sent as null, never as an empty argument', () => {
  const args = buildQuestionBankV3Args(filtersFromSearchParams(parse('')), 0, 20);

  assert.equal(args.p_subject_id, null);
  assert.equal(args.p_chapter_id, null);
  assert.equal(args.p_topic_id, null);
  assert.equal(args.p_year, null);
});

test('an "Authentication required" refusal is not mistaken for an empty bank', () => {
  assert.equal(
    describeQuestionBankError({ code: '42501', message: 'Authentication required' }),
    'questionBank.authRequired'
  );
  assert.equal(
    describeQuestionBankError({ code: '22023', message: 'invalid_arguments' }),
    'questionBank.loadError'
  );
});
