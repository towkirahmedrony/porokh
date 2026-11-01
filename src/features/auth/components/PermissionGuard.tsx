import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import HomeSkeleton from "@/features/dashboard/components/HomeSkeleton";

import { useAuth } from "../hooks/useAuth";
import { readPendingVerificationEmail } from "../utils/pendingVerification";
import { useLanguage } from "@/shared/i18n/LanguageProvider";

interface PermissionGuardProps {
  children: ReactNode;
  requiredPermission?: string;
  fallback?: ReactNode;
}

function PermissionGuardLoader() {
  return <HomeSkeleton />;
}

function AccessDenied() {
  const { t } = useLanguage();

  return (
    <div className="flex h-[60vh] flex-col items-center justify-center p-4 text-center">
      <ShieldAlert className="mb-4 h-12 w-12 text-accent" aria-hidden="true" />
      <h2 className="text-xl font-bold text-text-primary">{t('auth.accessDenied')}</h2>
      <p className="mt-2 text-text-secondary">{t('auth.noPermission')}</p>
    </div>
  );
}

export function PermissionGuard({
  children,
  requiredPermission,
  fallback,
}: PermissionGuardProps) {
  const { user, role, permissions, loading, profileLoading } = useAuth();
  const location = useLocation();

  // The onboarding flag comes from the profile row, not the JWT. Wait for the
  // enrichment pass so a returning user is never mistaken for a new one.
  if (loading || (user && profileLoading)) {
    return <PermissionGuardLoader />;
  }

  if (!user) {
    if (readPendingVerificationEmail()) {
      return <Navigate to="/auth/verify-email" replace />;
    }

    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  const provider = user.app_metadata?.provider;
  const isOAuthUser = provider && provider !== "email";
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

  if (!user.onboarding_completed_at) {
    return <Navigate to="/onboarding" replace />;
  }

  const safePermissions = Array.isArray(permissions) ? permissions : [];
  const hasPermission =
    role === "admin" ||
    role === "super_admin" ||
    !requiredPermission ||
    safePermissions.includes(requiredPermission);

  if (!hasPermission) {
    return <>{fallback ?? <AccessDenied />}</>;
  }

  return <>{children}</>;
}
