import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import HomeSkeleton from '@/features/dashboard/components/HomeSkeleton';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { readPendingVerificationEmail } from '@/features/auth/utils/pendingVerification';
import { ProfileLoadError } from './ProfileLoadError';
import {
  debugOnboardingGate,
  decideOnboardingState,
} from '../utils/onboardingGate';

/** Runs the same ordered checks as PermissionGuard, then renders onboarding. */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const {
    user,
    loading,
    profileStatus,
    profileError,
    refreshProfile,
  } = useAuth();

  const onboarding = decideOnboardingState({
    authLoading: loading,
    userId: user?.id ?? null,
    profileStatus,
    onboardingCompletedAt: user?.onboarding_completed_at,
    profileError,
  });

  debugOnboardingGate(
    'onboarding',
    onboarding,
    user?.onboarding_completed_at,
    profileStatus,
    profileError
  );

  if (onboarding.status === 'loading') {
    return <HomeSkeleton />;
  }

  if (onboarding.status === 'signed-out') {
    if (readPendingVerificationEmail()) {
      return <Navigate to="/auth/verify-email" replace />;
    }

    return <Navigate to="/auth/login" replace />;
  }

  const provider = user?.app_metadata?.provider;
  const isOAuthUser = provider && provider !== 'email';
  const isEmailVerified = Boolean(user?.email_confirmed_at) || Boolean(isOAuthUser);

  if (!isEmailVerified) {
    return (
      <Navigate
        to="/auth/verify-email"
        state={{ email: user?.email }}
        replace
      />
    );
  }

  if (onboarding.status === 'error') {
    return <ProfileLoadError onRetry={refreshProfile} />;
  }

  if (onboarding.status === 'complete') {
    return <Navigate to="/dashboard/home" replace />;
  }

  return <>{children}</>;
}
