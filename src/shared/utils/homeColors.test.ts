import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveHomeColor } from './homeColors';

test('hex values pass through', () => {
  assert.equal(resolveHomeColor('#16a34a'), '#16a34a');
  assert.equal(resolveHomeColor(' #FFF '), '#FFF');
});

test('legacy Tailwind palette classes map to hex', () => {
  assert.equal(resolveHomeColor('text-green-600'), '#16a34a');
  assert.equal(resolveHomeColor('bg-slate-50'), '#f8fafc');
  assert.equal(resolveHomeColor('text-red-500'), '#ef4444');
});

test('empty and unknown values return undefined so the theme default wins', () => {
  assert.equal(resolveHomeColor(''), undefined);
  assert.equal(resolveHomeColor(null), undefined);
  assert.equal(resolveHomeColor('text-brand-primary'), undefined);
  assert.equal(resolveHomeColor('javascript:alert(1)'), undefined);
});
