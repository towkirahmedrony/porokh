import type { AppMessageKey } from '@/shared/i18n/messages';

/**
 * Maps a question-bank failure to a user-facing message key.
 *
 * Raw database or transport text is never shown to students: Postgres error
 * messages can contain table/column names, policy names and query fragments.
 */
export type QuestionBankErrorKey = Extract<
  AppMessageKey,
  | 'questionBank.authRequired'
  | 'questionBank.rateLimited'
  | 'questionBank.networkError'
  | 'questionBank.loadError'
>;

const AUTH_SIGNALS = [
  '42501',
  'pgrst301',
  'jwt',
  'authentication required',
  'permission denied',
  'not authenticated',
  'invalid claim',
  'aoth_required',
];

const RATE_LIMIT_SIGNALS = ['429', 'rate limit', 'too many requests', 'pgrst102'];

const NETWORK_SIGNALS = [
  'failed to fetch',
  'networkerror',
  'network error',
  'timeout',
  'timed out',
  'econn',
  'etimedout',
  'load failed',
  'offline',
];

const readString = (source: Record<string, unknown>, key: string): string => {
  const value = source[key];
  return typeof value === 'string' ? value.toLowerCase() : '';
};

export const describeQuestionBankError = (error: unknown): QuestionBankErrorKey => {
  if (error === null || error === undefined) return 'questionBank.loadError';

  if (typeof error === 'string') {
    return classify(error.toLowerCase());
  }

  if (typeof error !== 'object') return 'questionBank.loadError';

  const source = error as Record<string, unknown>;
  if (typeof source.code === 'string' && source.code === 'AUTH_REQUIRED') {
    return 'questionBank.authRequired';
  }

  const haystack = [
    readString(source, 'code'),
    readString(source, 'message'),
    readString(source, 'details'),
    readString(source, 'hint'),
    readString(source, 'name'),
    source.status !== undefined ? String(source.status) : '',
  ]
    .filter(Boolean)
    .join(' ');

  return classify(haystack);
};

function classify(haystack: string): QuestionBankErrorKey {
  if (AUTH_SIGNALS.some((signal) => haystack.includes(signal))) {
    return 'questionBank.authRequired';
  }
  if (RATE_LIMIT_SIGNALS.some((signal) => haystack.includes(signal))) {
    return 'questionBank.rateLimited';
  }
  if (NETWORK_SIGNALS.some((signal) => haystack.includes(signal))) {
    return 'questionBank.networkError';
  }
  return 'questionBank.loadError';
}

/**
 * True when the RPC itself is not deployed. PostgREST answers PGRST202/203 for
 * an unknown function or parameter set; 42883 is the raw Postgres equivalent.
 * Used to fall back from the paginated v2 RPC to the legacy v1 RPC.
 */
export const isMissingRpcError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;

  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === 'string' ? candidate.code : '';
  if (code === 'PGRST202' || code === 'PGRST203' || code === '42883') return true;

  const message = typeof candidate.message === 'string' ? candidate.message : '';
  return (
    message.includes('Could not find the function') ||
    message.includes('does not exist')
  );
};
