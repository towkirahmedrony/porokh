import test from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEYS } from '@/shared/constants/storageKeys';
import {
  normalizeLanguage,
  readStoredLanguage,
  resolveInitialLanguage,
  shouldAdoptProfileLanguage,
  type LanguageStorage,
} from './languagePreference';
import {
  APP_LANGUAGES,
  APP_MESSAGES,
  DEFAULT_APP_LANGUAGE,
  lookupMessage,
  type AppMessageKey,
} from './messages';

/** In-memory stand-in for `window.localStorage`. */
const createStorage = (initial: Record<string, string> = {}): LanguageStorage & {
  data: Record<string, string>;
} => {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string) => (key in data ? data[key] : null),
  };
};

test('language values are normalised and unknown values are rejected', () => {
  assert.equal(normalizeLanguage('en'), 'en');
  assert.equal(normalizeLanguage(' BN '), 'bn');
  assert.equal(normalizeLanguage('fr'), null);
  assert.equal(normalizeLanguage(''), null);
  assert.equal(normalizeLanguage(null), null);
  assert.equal(normalizeLanguage(42), null);
});

test('stored preference is read from both the JSON and plain-string forms', () => {
  const json = createStorage({ [STORAGE_KEYS.LANGUAGE]: '"en"' });
  const plain = createStorage({ [STORAGE_KEYS.LANGUAGE]: 'bn' });

  assert.equal(readStoredLanguage(json), 'en');
  assert.equal(readStoredLanguage(plain), 'bn');
  assert.equal(readStoredLanguage(createStorage()), null);
});

test('unreadable or corrupt storage never throws', () => {
  const broken: LanguageStorage = {
    getItem: () => {
      throw new Error('SecurityError');
    },
  };
  assert.equal(readStoredLanguage(broken), null);

  const corrupt = createStorage({ [STORAGE_KEYS.LANGUAGE]: '{"oops"' });
  assert.equal(readStoredLanguage(corrupt), null);
});

/**
 * Regression test for the reported bug: the switcher wrote the new language,
 * then the profile-preference effect immediately restored the stale server
 * value, so the click appeared to do nothing.
 */
test('an explicit local choice is not overridden by the profile preference', () => {
  const stored = readStoredLanguage(
    createStorage({ [STORAGE_KEYS.LANGUAGE]: '"en"' })
  );

  assert.equal(stored, 'en');
  assert.equal(
    shouldAdoptProfileLanguage(stored, 'bn'),
    false,
    'a persisted choice must win over the profile value'
  );
  assert.equal(resolveInitialLanguage(stored, 'bn'), 'en');
});

test('the profile preference seeds a browser that has never chosen', () => {
  const stored = readStoredLanguage(createStorage());

  assert.equal(stored, null);
  assert.equal(shouldAdoptProfileLanguage(stored, 'en'), true);
  assert.equal(resolveInitialLanguage(stored, 'en'), 'en');
});

test('invalid profile values are ignored instead of breaking the language', () => {
  assert.equal(shouldAdoptProfileLanguage(null, 'klingon'), false);
  assert.equal(shouldAdoptProfileLanguage(null, undefined), false);
  assert.equal(resolveInitialLanguage(null, 'klingon'), DEFAULT_APP_LANGUAGE);
});

test('the default language is Bangla when nothing is stored', () => {
  assert.equal(resolveInitialLanguage(null), 'bn');
  assert.equal(DEFAULT_APP_LANGUAGE, 'bn');
});

test('every Bengali key has a non-empty English translation', () => {
  const bnKeys = Object.keys(APP_MESSAGES.bn) as AppMessageKey[];

  for (const key of bnKeys) {
    const value = APP_MESSAGES.en[key];
    assert.ok(
      typeof value === 'string' && value.trim().length > 0,
      `missing English translation for "${key}"`
    );
  }

  assert.deepEqual(Object.keys(APP_MESSAGES.en).sort(), [...bnKeys].sort());
});

test('language dictionaries agree for every configured language', () => {
  for (const language of APP_LANGUAGES) {
    assert.ok(APP_MESSAGES[language], `missing dictionary for ${language}`);
  }
});

test('a missing translation key falls back instead of crashing', () => {
  const unknownKey = 'this.keyDoesNotExist' as AppMessageKey;

  assert.equal(lookupMessage('en', unknownKey), unknownKey);
  assert.equal(lookupMessage('bn', unknownKey), unknownKey);
});

test('known keys resolve in the active language', () => {
  assert.equal(lookupMessage('bn', 'nav.home'), 'হোম');
  assert.equal(lookupMessage('en', 'nav.home'), 'Home');
  assert.notEqual(lookupMessage('bn', 'questionBank.results'), lookupMessage('en', 'questionBank.results'));
});

test('question bank keys exist in both languages', () => {
  const required: AppMessageKey[] = [
    'questionBank.selectSubject',
    'questionBank.showingCount',
    'questionBank.loadMore',
    'questionBank.lockedPreview',
    'questionBank.explanation',
    'questionBank.authRequired',
    'questionBank.networkError',
    'questionBank.rateLimited',
  ];

  for (const key of required) {
    assert.ok(APP_MESSAGES.bn[key], `bn missing ${key}`);
    assert.ok(APP_MESSAGES.en[key], `en missing ${key}`);
  }
});
