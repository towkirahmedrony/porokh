import type { ProfileStatus } from '@/features/auth/types/auth';

/**
 * The onboarding flag exists only on the profile row, so the gate has three
 * answers, not two: loading (the row has not been read yet), complete, and
 * incomplete. "Loading" must never be treated as "incomplete" — that is how a
 * finished user gets sent back to the form on every cold start.
 */
export type OnboardingGateState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'complete'; completedAt: string }
  | { status: 'incomplete' }
  | { status: 'error'; message: string | null };

export interface OnboardingGateInput {
  authLoading: boolean;
  userId: string | null;
  profileStatus: ProfileStatus;
  onboardingCompletedAt: string | null | undefined;
  profileError?: string | null;
}

export function decideOnboardingState({
  authLoading,
  userId,
  profileStatus,
  onboardingCompletedAt,
  profileError,
}: OnboardingGateInput): OnboardingGateState {
  if (authLoading) return { status: 'loading' };

  if (!userId) return { status: 'signed-out' };

  if (profileStatus === 'idle' || profileStatus === 'loading') {
    return { status: 'loading' };
  }

  if (profileStatus === 'error') {
    return { status: 'error', message: profileError ?? null };
  }

  if (onboardingCompletedAt) {
    return { status: 'complete', completedAt: onboardingCompletedAt };
  }

  return { status: 'incomplete' };
}

/**
 * Temporary diagnostics for the app (development builds only). Enable it by
 * running a dev server; production bundles never reach this branch.
 */
export function debugOnboardingGate(
  source: 'permission' | 'onboarding',
  state: OnboardingGateState,
  rawOnboardingCompletedAt: string | null | undefined,
  profileStatus: ProfileStatus,
  profileError?: string | null
): void {
  const isDev = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV;
  if (!isDev) return;

  console.info('[onboarding-gate]', {
    source,
    decision: state.status,
    profileStatus,
    onboarding_completed_at: rawOnboardingCompletedAt ?? null,
    profileError: profileError ?? null,
  });
}
