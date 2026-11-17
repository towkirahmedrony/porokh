import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSubmissionRequestId,
  isValidSubmissionRequestId,
} from './examSubmissionRequestTelemetry.ts';

test('submission request IDs are unique UUID-shaped safe values per invocation', () => {
  const first = createSubmissionRequestId();
  const second = createSubmissionRequestId();

  assert.match(first, /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/);
  assert.match(second, /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/);
  assert.notEqual(first, second);
});

test('request ID validation rejects log injection and oversized identifiers', () => {
  assert.equal(isValidSubmissionRequestId('9a0d5f4e-1111-4222-8333-444455556666'), true);
  assert.equal(isValidSubmissionRequestId('short'), false);
  assert.equal(isValidSubmissionRequestId('valid-id-123\nforged-log'), false);
  assert.equal(isValidSubmissionRequestId('x'.repeat(129)), false);
});
