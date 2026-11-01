import test from 'node:test';
import assert from 'node:assert/strict';
import { HelpCircle } from 'lucide-react';
import {
  HOME_ICONS,
  HOME_ICON_NAMES,
  isKnownHomeIcon,
  normalizeHomeIconName,
  resolveHomeIcon,
} from './homeIcons';

test('canonical kebab-case names resolve to their registry component', () => {
  for (const name of HOME_ICON_NAMES) {
    assert.equal(normalizeHomeIconName(name), name);
    assert.equal(resolveHomeIcon(name), HOME_ICONS[name]);
    assert.equal(isKnownHomeIcon(name), true);
  }
});

test('PascalCase and camelCase values from older rows are normalized', () => {
  assert.equal(normalizeHomeIconName('GraduationCap'), 'graduation-cap');
  assert.equal(normalizeHomeIconName('ClipboardCheck'), 'clipboard-check');
  assert.equal(normalizeHomeIconName('graduationCap'), 'graduation-cap');
  assert.equal(resolveHomeIcon('GraduationCap'), HOME_ICONS['graduation-cap']);
});

test('legacy aliases and loose formatting map to canonical names', () => {
  assert.equal(normalizeHomeIconName('Hat'), 'graduation-cap');
  assert.equal(normalizeHomeIconName('hat'), 'graduation-cap');
  assert.equal(normalizeHomeIconName('BarChart'), 'bar-chart');
  assert.equal(normalizeHomeIconName('bar_chart'), 'bar-chart');
  assert.equal(normalizeHomeIconName('  trophy  '), 'trophy');
  assert.equal(resolveHomeIcon('Hat'), HOME_ICONS['graduation-cap']);
});

test('unknown, missing and malformed values fall back without throwing', () => {
  assert.equal(resolveHomeIcon('H'), HelpCircle);
  assert.equal(resolveHomeIcon('definitely-not-an-icon'), HelpCircle);
  assert.equal(resolveHomeIcon(''), HelpCircle);
  assert.equal(resolveHomeIcon(undefined), HelpCircle);
  assert.equal(resolveHomeIcon(null), HelpCircle);

  assert.equal(isKnownHomeIcon('H'), false);
  assert.equal(isKnownHomeIcon(''), false);
  assert.equal(isKnownHomeIcon(null), false);
});

test('normalization never returns a non-string for odd input', () => {
  assert.equal(normalizeHomeIconName('   '), '');
  assert.equal(normalizeHomeIconName(undefined), '');
  assert.equal(normalizeHomeIconName(null), '');
});
