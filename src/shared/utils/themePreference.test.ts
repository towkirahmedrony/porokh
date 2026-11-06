import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_THEME_PREFERENCE,
  getNextThemePreference,
  normalizeThemePreference,
  resolveTheme,
  resolveThemePreference,
} from './themePreference';

test('theme preferences are normalised and unknown values are rejected', () => {
  assert.equal(normalizeThemePreference('light'), 'light');
  assert.equal(normalizeThemePreference('dark'), 'dark');
  assert.equal(normalizeThemePreference('system'), 'system');
  assert.equal(normalizeThemePreference('sepia'), null);
  assert.equal(normalizeThemePreference(''), null);
  assert.equal(normalizeThemePreference(null), null);
  assert.equal(normalizeThemePreference(undefined), null);
  assert.equal(normalizeThemePreference(42), null);
});

test('the default theme preference is the device system theme', () => {
  assert.equal(DEFAULT_THEME_PREFERENCE, 'system');
});

test('the system preference follows the device light/dark setting', () => {
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
});

test('an explicit light/dark preference is preserved over the system setting', () => {
  assert.equal(resolveTheme('dark', false), 'dark');
  assert.equal(resolveTheme('dark', true), 'dark');
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('light', false), 'light');
});

test('missing or invalid stored preferences fall back to the system theme', () => {
  assert.equal(resolveThemePreference(null, true), 'dark');
  assert.equal(resolveThemePreference(null, false), 'light');
  assert.equal(resolveThemePreference(undefined, true), 'dark');
  assert.equal(resolveThemePreference('sepia', false), 'light');
  assert.equal(resolveThemePreference('dark', false), 'dark');
  assert.equal(resolveThemePreference('light', true), 'light');
});

test('toggling flips the currently resolved theme, including system dark', () => {
  assert.equal(getNextThemePreference('dark'), 'light');
  assert.equal(getNextThemePreference('light'), 'dark');
});
