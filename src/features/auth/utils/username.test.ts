import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidUsername, normalizeUsername } from './username';

test('username normalization trims whitespace and folds case', () => {
  assert.equal(normalizeUsername('  ToWkir_7  '), 'towkir_7');
});

test('username policy accepts only 3-20 lowercase ASCII letters, digits, and underscores', () => {
  for (const valid of ['abc', 'a_b9', 'student_2026']) assert.equal(isValidUsername(valid), true);
  for (const invalid of ['', 'ab', 'user-name', 'user.name', 'éuser', 'a'.repeat(21)]) {
    assert.equal(isValidUsername(invalid), false, invalid);
  }
});
