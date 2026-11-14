import test from 'node:test';
import assert from 'node:assert/strict';

// StorageUtils only talks to `window.localStorage`; provide just enough of it so
// the cache logic can be exercised without a browser.
const store = new Map<string, string>();

(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  },
  dispatchEvent: () => true,
};

const { STORAGE_KEYS } = await import('@/shared/constants/storageKeys');
const { StorageUtils } = await import('@/shared/utils/storage');
const {
  PROFILE_CACHE_VERSION,
  clearCachedProfile,
  normalizeCachedProfile,
  readCachedProfile,
  writeCachedProfile,
} = await import('./profileCache');

const profileFor = (overrides: Record<string, unknown> = {}) =>
  normalizeCachedProfile({
    username: 'rahim',
    full_name: 'Rahim Uddin',
    avatar_url: 'https://cdn.example/avatar.png',
    institution: 'Dhaka College',
    total_xp: 420,
    language_preference: 'bn',
    class_level: 'hsc',
    group: 'science',
    study_goal: 'medical',
    onboarding_completed_at: '2026-11-01T08:26:00.000Z',
    ...overrides,
  });

test('a written profile is readable again after a restart', () => {
  store.clear();
  writeCachedProfile('user-1', profileFor(), 1_700_000_000_000);

  const cached = readCachedProfile('user-1');

  assert.ok(cached);
  assert.equal(cached.full_name, 'Rahim Uddin');
  assert.equal(cached.onboarding_completed_at, '2026-11-01T08:26:00.000Z');
  assert.equal(cached.total_xp, 420);
});

test('one account never answers for another', () => {
  store.clear();
  writeCachedProfile('user-1', profileFor());

  assert.equal(readCachedProfile('user-2'), null);
  assert.equal(readCachedProfile(null), null);
});

test('a cache entry from an older schema version is ignored', () => {
  store.clear();
  StorageUtils.set(
    `${STORAGE_KEYS.AUTH_PROFILE_CACHE_PREFIX}user-1`,
    {
      version: PROFILE_CACHE_VERSION + 1,
      userId: 'user-1',
      cachedAt: Date.now(),
      profile: profileFor(),
    } as never
  );

  assert.equal(readCachedProfile('user-1'), null);
});

test('a cache entry filed under the wrong user id is ignored', () => {
  store.clear();
  StorageUtils.set(
    `${STORAGE_KEYS.AUTH_PROFILE_CACHE_PREFIX}user-1`,
    {
      version: PROFILE_CACHE_VERSION,
      userId: 'user-2',
      cachedAt: Date.now(),
      profile: profileFor(),
    } as never
  );

  assert.equal(readCachedProfile('user-1'), null);
});

test('clearing one account leaves the others intact', () => {
  store.clear();
  writeCachedProfile('user-1', profileFor());
  writeCachedProfile('user-2', profileFor({ full_name: 'Other Student' }));

  clearCachedProfile('user-1');

  assert.equal(readCachedProfile('user-1'), null);
  assert.equal(readCachedProfile('user-2')?.full_name, 'Other Student');
});

test('normalisation drops unknown fields and mistyped values', () => {
  const normalized = normalizeCachedProfile({
    full_name: 'Rahim Uddin',
    total_xp: 'not-a-number',
    onboarding_completed_at: 123,
    unexpected_secret: 'must not be cached',
  });

  assert.equal(normalized.full_name, 'Rahim Uddin');
  assert.equal(normalized.total_xp, null);
  assert.equal(normalized.onboarding_completed_at, null);
  assert.equal('unexpected_secret' in normalized, false);
});

test('an unreadable cache entry degrades to a miss instead of throwing', () => {
  store.clear();
  store.set(`${STORAGE_KEYS.AUTH_PROFILE_CACHE_PREFIX}user-1`, '{not json');

  assert.equal(readCachedProfile('user-1'), null);
});
