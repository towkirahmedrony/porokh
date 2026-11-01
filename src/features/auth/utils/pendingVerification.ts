import { STORAGE_KEYS } from '@/shared/constants/storageKeys';

const read = (): string | null => {
  if (typeof window === 'undefined') return null;

  try {
    return window.sessionStorage.getItem(STORAGE_KEYS.SIGNUP_PENDING_VERIFICATION);
  } catch {
    return null;
  }
};

export const rememberPendingVerificationEmail = (email: string): void => {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(
      STORAGE_KEYS.SIGNUP_PENDING_VERIFICATION,
      email.trim().toLowerCase()
    );
  } catch {
    // The verification page can still use the signed-in user's email.
  }
};

export const readPendingVerificationEmail = (): string | null => {
  const email = read()?.trim().toLowerCase();
  return email ? email : null;
};

export const clearPendingVerificationEmail = (): void => {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.removeItem(STORAGE_KEYS.SIGNUP_PENDING_VERIFICATION);
  } catch {
    // Nothing else owns this key.
  }
};

const RESEND_COOLDOWN_MS = 60_000;

export const readResendAvailableAt = (): number => {
  if (typeof window === 'undefined') return 0;

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEYS.SIGNUP_VERIFY_RESEND_AT);
    const value = raw ? Number(raw) : 0;
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
};

export const markResendSent = (now = Date.now()): number => {
  const availableAt = now + RESEND_COOLDOWN_MS;

  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(
        STORAGE_KEYS.SIGNUP_VERIFY_RESEND_AT,
        String(availableAt)
      );
    } catch {
      // A refresh can reset the cooldown; the server still rate limits.
    }
  }

  return availableAt;
};

export const cooldownSecondsLeft = (availableAt: number, now = Date.now()): number =>
  Math.max(0, Math.ceil((availableAt - now) / 1000));
