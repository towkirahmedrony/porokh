import test from 'node:test';
import assert from 'node:assert/strict';
import { decideOnboardingState } from './onboardingGate';

const base = {
  authLoading: false,
  userId: 'user-1',
  profileStatus: 'ready' as const,
  onboardingCompletedAt: '2026-11-01T08:26:00.000Z' as string | null,
  profileError: null,
};

test('a loaded profile with a timestamp is complete', () => {
  assert.deepEqual(decideOnboardingState(base), {
    status: 'complete',
    completedAt: '2026-11-01T08:26:00.000Z',
  });
});

test('a loaded profile with a null timestamp is the only incomplete answer', () => {
  assert.deepEqual(
    decideOnboardingState({ ...base, onboardingCompletedAt: null }),
    { status: 'incomplete' }
  );
});

test('a profile that has not been read yet is loading, never incomplete', () => {
  for (const profileStatus of ['idle', 'loading'] as const) {
    for (const onboardingCompletedAt of [undefined, null]) {
      assert.deepEqual(
        decideOnboardingState({
          ...base,
          profileStatus,
          onboardingCompletedAt,
        }),
        { status: 'loading' }
      );
    }
  }
});

test('auth initialization is loading even when a stale user object exists', () => {
  assert.deepEqual(
    decideOnboardingState({
      ...base,
      authLoading: true,
      onboardingCompletedAt: null,
    }),
    { status: 'loading' }
  );
});

test('a failed profile read is an error, not "not onboarded"', () => {
  assert.deepEqual(
    decideOnboardingState({
      ...base,
      profileStatus: 'error',
      onboardingCompletedAt: null,
      profileError: 'permission denied',
    }),
    { status: 'error', message: 'permission denied' }
  );
});

test('no signed-in user is signed-out regardless of profile status', () => {
  assert.deepEqual(
    decideOnboardingState({
      ...base,
      userId: null,
      profileStatus: 'idle',
      onboardingCompletedAt: null,
    }),
    { status: 'signed-out' }
  );
});
