import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import HomeSkeleton from '@/features/dashboard/components/HomeSkeleton';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { readPendingVerificationEmail } from '@/features/auth/utils/pendingVerification';

/** Runs the same ordered checks as PermissionGuard, then renders onboarding. */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const { user, loading, profileLoading } = useAuth();

  if (loading || (user && profileLoading)) {
    return <HomeSkeleton />;
  }

  if (!user) {
    if (readPendingVerificationEmail()) {
      return <Navigate to="/auth/verify-email" replace />;
    }

    return <Navigate to="/auth/login" replace />;
  }

  const provider = user.app_metadata?.provider;
  const isOAuthUser = provider && provider !== 'email';
  const isEmailVerified = Boolean(user.email_confirmed_at) || Boolean(isOAuthUser);

  if (!isEmailVerified) {
    return (
      <Navigate
        to="/auth/verify-email"
        state={{ email: user.email }}
        replace
      />
    );
  }

  if (user.onboarding_completed_at) {
    return <Navigate to="/dashboard/home" replace />;
  }

  return <>{children}</>;
}
