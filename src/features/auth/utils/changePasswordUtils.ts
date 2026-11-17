import type { AppMessageKey } from '@/shared/i18n/messages';

export const MIN_PASSWORD_LENGTH = 8;

export const DASHBOARD_HOME_PATH = "/dashboard/home";
export const LOGIN_PATH = "/auth/login";
export const FORGOT_PASSWORD_PATH = "/auth/forgot-password";

export type PasswordField = "old" | "new" | "confirm";

export type RecoveryParams = {
  isRecovery: boolean;
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
};

export type PasswordVisibilityState = Record<PasswordField, boolean>;

export function getHashParams() {
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

export function getRecoveryParams(searchParams: URLSearchParams): RecoveryParams {
  const hashParams = getHashParams();

  const searchType = searchParams.get("type");
  const hashType = hashParams.get("type");

  const searchMode = searchParams.get("mode");
  const hashMode = hashParams.get("mode");

  const code = searchParams.get("code") ?? hashParams.get("code");
  const accessToken = hashParams.get("access_token") ?? searchParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token") ?? searchParams.get("refresh_token");

  const isRecovery =
    searchMode === "recovery" ||
    hashMode === "recovery" ||
    searchType === "recovery" ||
    hashType === "recovery" ||
    Boolean(code) ||
    Boolean(accessToken && refreshToken);

  return {
    isRecovery,
    code,
    accessToken,
    refreshToken,
  };
}

export { MessageError } from '@/shared/i18n/localize';
import { MessageError } from '@/shared/i18n/localize';

export function getErrorMessage(_error?: unknown): AppMessageKey {
  // Raw Auth/network messages can contain request internals, so the UI only
  // ever shows a stable user-facing message for unrecognised failures.
  return "auth.pw.genericError";
}

export function getUpdatePasswordErrorMessage(error: unknown): AppMessageKey {
  if (error instanceof MessageError) return error.key;

  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("same password") || message.includes("different")) {
    return "auth.pw.mustDiffer";
  }

  if (message.includes("rate limit") || message.includes("too many")) {
    return "auth.pw.rateLimited";
  }

  if (message.includes("network") || message.includes("fetch")) {
    return "auth.pw.networkError";
  }

  if (message.includes("weak") || message.includes("password")) {
    return "auth.pw.weakPassword";
  }

  if (
    message.includes("session") ||
    message.includes("jwt") ||
    message.includes("expired") ||
    message.includes("invalid login")
  ) {
    return "auth.pw.sessionExpired";
  }

  return getErrorMessage(error);
}

export function validatePasswordForm({
  isRecoveryMode,
  oldPassword,
  newPassword,
  confirmPassword,
}: {
  isRecoveryMode: boolean;
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}): AppMessageKey | null {
  if (!isRecoveryMode && !oldPassword) {
    return "auth.pw.currentRequired";
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return "auth.pw.minCharacters";
  }

  if (newPassword !== confirmPassword) {
    return "auth.pw.mismatch";
  }

  if (!isRecoveryMode && oldPassword === newPassword) {
    return "auth.pw.sameAsCurrent";
  }

  return null;
}

export function clearRecoveryUrlTokens() {
  window.history.replaceState(null, "", window.location.pathname);
}
