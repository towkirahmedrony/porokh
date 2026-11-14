import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCachedProfile,
  isSameAppUser,
  isSameSession,
  mergeSessionUser,
  needsProfileEnrichment,
} from './authSessionSync';
import { normalizeCachedProfile } from './profileCache';
import type { AppUser } from '../types/auth';

const makeSession = (accessToken: string, userId = 'user-1') => ({
  access_token: accessToken,
  refresh_token: 'refresh',
  user: { id: userId },
});

const makeUser = (overrides: Partial<AppUser> = {}) =>
  ({
    id: 'user-1',
    email: 'student@example.com',
    email_confirmed_at: '2026-01-01T00:00:00.000Z',
    app_metadata: { provider: 'email' },
    user_metadata: { full_name: 'Metadata Name' },
    full_name: 'Metadata Name',
    username: null,
    avatar_url: null,
    institution: null,
    language_preference: 'bn',
    total_xp: 0,
    total_score: 0,
    ...overrides,
  }) as AppUser;

test('a token refresh keeps the profile name instead of falling back to JWT data', () => {
  const enriched = makeUser({ full_name: 'Rahim Uddin', username: 'rahim', total_xp: 420 });

  const refreshed = mergeSessionUser(
    makeUser({ full_name: 'Metadata Name', total_xp: undefined as unknown as number }),
    enriched
  );

  assert.equal(refreshed.full_name, 'Rahim Uddin');
  assert.equal(refreshed.username, 'rahim');
  assert.equal(refreshed.total_xp, 420);
});

test('a token refresh keeps the onboarding flag and academic fields', () => {
  const enriched = makeUser({
    onboarding_completed_at: '2026-11-01T08:26:00.000Z',
    class_level: 'hsc',
    group: 'science',
    study_goal: 'medical',
  });

  const refreshed = mergeSessionUser(
    makeUser({
      onboarding_completed_at: undefined,
      class_level: undefined,
      group: undefined,
      study_goal: undefined,
    }),
    enriched
  );

  assert.equal(refreshed.onboarding_completed_at, '2026-11-01T08:26:00.000Z');
  assert.equal(refreshed.class_level, 'hsc');
  assert.equal(refreshed.group, 'science');
  assert.equal(refreshed.study_goal, 'medical');
  assert.equal(isSameAppUser(enriched, refreshed), true);
});

test('missing the onboarding flag counts as a real user change', () => {
  assert.equal(
    isSameAppUser(
      makeUser({ onboarding_completed_at: '2026-11-01T08:26:00.000Z' }),
      makeUser({ onboarding_completed_at: null })
    ),
    false
  );
});

test('profile fields from another account are never carried over', () => {
  const previous = makeUser({ id: 'user-1', full_name: 'Old User' });

  const refreshed = mergeSessionUser(
    { ...makeUser({ id: 'user-2', full_name: 'Other' }), full_name: 'Other' },
    previous
  );

  assert.equal(refreshed.id, 'user-2');
  assert.equal(refreshed.full_name, 'Other');
});

test('identical auth payloads compare equal so no redundant render is scheduled', () => {
  assert.equal(isSameAppUser(makeUser(), makeUser()), true);
  assert.equal(isSameAppUser(makeUser(), makeUser({ full_name: 'Changed' })), false);
  assert.equal(
    isSameAppUser(makeUser(), makeUser({ email_confirmed_at: undefined })),
    false
  );
});

test('session comparison ignores object identity but respects real changes', () => {
  assert.equal(isSameSession(null, null), true);
  assert.equal(isSameSession(makeSession('a') as any, null), false);
  assert.equal(isSameSession(makeSession('a') as any, makeSession('a') as any), true);
  assert.equal(isSameSession(makeSession('a') as any, makeSession('b') as any), false);
});

test('a cached profile row resolves the gate without any network read', () => {
  const cached = normalizeCachedProfile({
    full_name: 'Rahim Uddin',
    username: 'rahim',
    class_level: 'hsc',
    group: 'science',
    study_goal: 'medical',
    onboarding_completed_at: '2026-11-01T08:26:00.000Z',
    total_xp: 420,
  });

  const restored = applyCachedProfile(
    makeUser({ onboarding_completed_at: undefined, total_xp: 0 }),
    cached
  );

  assert.equal(restored.onboarding_completed_at, '2026-11-01T08:26:00.000Z');
  assert.equal(restored.class_level, 'hsc');
  assert.equal(restored.full_name, 'Rahim Uddin');
  assert.equal(restored.total_xp, 420);
  assert.equal(restored.total_score, 420);
  // The JWT identity fields are untouched by the profile overlay.
  assert.equal(restored.id, 'user-1');
  assert.equal(restored.email, 'student@example.com');
});

/** A cached null is a real answer: an empty name must not fall back to a JWT claim. */
test('a cached null clears a stale value instead of keeping it', () => {
  const restored = applyCachedProfile(
    makeUser({ full_name: 'Old Name', avatar_url: 'https://cdn/old.png' }),
    normalizeCachedProfile({ full_name: null, avatar_url: null })
  );

  assert.equal(restored.full_name, null);
  assert.equal(restored.avatar_url, null);
});

test('profile enrichment is tied to a user id, not to auth events', () => {
  assert.equal(needsProfileEnrichment(null, 'user-1'), true);
  assert.equal(needsProfileEnrichment('user-1', 'user-1'), false);
  assert.equal(needsProfileEnrichment('user-1', 'user-2'), true);
  assert.equal(needsProfileEnrichment('user-1', null), false);
});
