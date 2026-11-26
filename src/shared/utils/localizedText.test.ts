import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDisplayText } from './localizedText';

test('a bilingual object resolves to the active language', () => {
  assert.equal(
    resolveDisplayText({ bn: 'সঠিক ব্যাখ্যা', en: 'The explanation' }, 'bn'),
    'সঠিক ব্যাখ্যা'
  );
  assert.equal(
    resolveDisplayText({ bn: 'সঠিক ব্যাখ্যা', en: 'The explanation' }, 'en'),
    'The explanation'
  );
});

test('a JSON string of a bilingual object never renders its braces', () => {
  const raw = '{"bn":"ব্যাখ্যা","en":"Explanation"}';
  const value = resolveDisplayText(raw, 'bn');

  assert.equal(value, 'ব্যাখ্যা');
  assert.equal(value.includes('{'), false);
  assert.equal(value.includes('"bn"'), false);
});

test('plain prose is returned unchanged', () => {
  assert.equal(resolveDisplayText('একটি সহজ ব্যাখ্যা', 'bn'), 'একটি সহজ ব্যাখ্যা');
});

test('broken or empty values resolve to an empty string instead of raw bytes', () => {
  assert.equal(resolveDisplayText(null, 'bn'), '');
  assert.equal(resolveDisplayText(undefined, 'bn'), '');
  assert.equal(resolveDisplayText('{not valid json', 'bn'), '');
  assert.equal(resolveDisplayText({}, 'bn'), '');
});
