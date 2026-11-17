export type AccessSource = 'subscription' | 'grant_user' | 'grant_all' | 'free';

export interface AccessState {
  tier: string;
  premium: boolean;
  source: AccessSource | string;
  premium_expires_at: string | null;
  unlimited_all: boolean;
  unlimited_features: string[] | null;
}

export interface FeatureUsage {
  feature: string;
  title_bn: string | null;
  title_en: string | null;
  unlimited: boolean;
  limit: number;
  used: number;
  remaining: number;
  reset_at: string | null;
}

export interface AccessPayload {
  access: AccessState | null;
  features: FeatureUsage[];
}

export type PaywallReason = 'free_limit' | 'premium_content';

export interface PaywallState {
  reason: PaywallReason;
  /** Daily limit reported by the server for the free-limit state. */
  limit?: number | null;
  /** ISO-8601 instant when the daily quota resets. */
  resetAt?: string | null;
}

/** Error codes the backend uses to reject metered or premium actions. */
export const ACCESS_ERROR_CODES = {
  freeLimit: 'FREE_LIMIT_REACHED',
  premiumRequired: 'PREMIUM_REQUIRED',
} as const;

export const isFreeLimitError = (error: unknown): boolean =>
  extractAccessErrorCode(error) === ACCESS_ERROR_CODES.freeLimit;

export const isPremiumRequiredError = (error: unknown): boolean =>
  extractAccessErrorCode(error) === ACCESS_ERROR_CODES.premiumRequired;

export const extractAccessErrorCode = (error: unknown): string | null => {
  const response = (error as { response?: { data?: Record<string, unknown>; status?: number } })
    ?.response;
  const payload = response?.data;
  if (!payload) return null;

  const code = payload.code ?? payload.error_code ?? payload.error;
  if (typeof code === 'string') return code;

  // Older backend builds only returned a message. Keep the UX working by
  // matching the two documented messages, but never guess anything else.
  const message = typeof payload.message === 'string' ? payload.message.toLowerCase() : '';
  if (message.includes('daily free exam limit')) return ACCESS_ERROR_CODES.freeLimit;
  if (message.includes('premium access is required')) return ACCESS_ERROR_CODES.premiumRequired;

  return null;
};

export const extractAccessErrorDetails = (error: unknown): Record<string, unknown> | null => {
  const data = (error as { response?: { data?: Record<string, unknown> } })?.response?.data;
  const details = data?.details;
  return details && typeof details === 'object' ? (details as Record<string, unknown>) : null;
};
