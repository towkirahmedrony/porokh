import test from 'node:test';
import assert from 'node:assert/strict';
import {
  groupPath,
  groupShareUrl,
  isGroupUuid,
  isValidGroupSlug,
  suggestGroupSlug,
} from './groupSlug';

test('slug validation matches the backend', () => {
  assert.equal(isValidGroupSlug('dhaka-toppers'), true);
  assert.equal(isValidGroupSlug('ab'), false);
  assert.equal(isValidGroupSlug('-nope'), false);
  assert.equal(isValidGroupSlug('Has Space'), false);
});

test('suggestions are URL safe', () => {
  assert.equal(suggestGroupSlug('Dhaka Science Squad!'), 'dhaka-science-squad');
  assert.equal(suggestGroupSlug('  '), '');
});

test('uuid detection does not confuse a slug', () => {
  assert.equal(isGroupUuid('00000000-0000-4000-8000-000000000001'), true);
  assert.equal(isGroupUuid('dhaka-toppers'), false);
});

test('paths and invite links use the slug', () => {
  assert.equal(groupPath('dhaka-toppers', 'chat'), '/groups/dhaka-toppers?tab=chat');
  assert.match(groupShareUrl('dhaka-toppers'), /\/groups\/dhaka-toppers$/);
  assert.match(groupShareUrl('dhaka-toppers', 'abcd1234'), /\?code=ABCD1234$/);
});
