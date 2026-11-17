import { resolveApiBaseUrl } from './apiConfig';

/**
 * Base used to expand relative request paths. Diagnostics must never throw on a
 * misconfigured environment, so an unset `VITE_API_URL` degrades to reporting
 * `unknown` instead of breaking the error handler that calls us.
 */
const optionalApiBase = (): string | undefined => {
  try {
    return resolveApiBaseUrl();
  } catch {
    return undefined;
  }
};

/**
 * Diagnostics for failed network calls. These records are safe to log or show
 * in a support report: they contain only the request method, the API origin
 * and path, and the status/code. Query strings, fragments, headers (including
 * Authorization and cookies), request bodies and Supabase tokens are dropped.
 */
export interface NetworkDiagnostic {
  method: string;
  origin: string;
  path: string;
  status?: number;
  code?: string;
  durationMs?: number;
}

interface DiagnosticInput {
  url?: string;
  method?: string;
  status?: number;
  code?: string;
  durationMs?: number;
}

/** Keep only origin and pathname; strip credentials, query and fragment. */
export const sanitizeApiUrl = (
  value: string,
  apiBase: string | undefined = optionalApiBase()
): { origin: string; path: string } => {
  try {
    const url = new URL(value, apiBase);
    return {
      origin: url.origin,
      path: url.pathname.replace(/\/+$/, '') || '/',
    };
  } catch {
    return { origin: 'unknown', path: 'unknown' };
  }
};

export const buildNetworkDiagnostic = (input: DiagnosticInput = {}): NetworkDiagnostic => {
  const apiBase = optionalApiBase();
  const { origin, path } = sanitizeApiUrl(input.url ?? apiBase ?? '', apiBase);
  const diagnostic: NetworkDiagnostic = {
    method: (input.method ?? 'GET').toUpperCase(),
    origin,
    path,
  };

  if (typeof input.status === 'number') diagnostic.status = input.status;
  if (input.code) diagnostic.code = input.code;
  if (typeof input.durationMs === 'number') {
    diagnostic.durationMs = Math.max(0, Math.round(input.durationMs));
  }

  return diagnostic;
};

/** One-line description used in development console output. */
export const formatNetworkDiagnostic = (input: DiagnosticInput = {}): string => {
  const diagnostic = buildNetworkDiagnostic(input);
  const status = diagnostic.status ? ` status=${diagnostic.status}` : '';
  const code = diagnostic.code ? ` code=${diagnostic.code}` : '';
  const duration =
    diagnostic.durationMs !== undefined ? ` duration=${diagnostic.durationMs}ms` : '';
  return `${diagnostic.method} ${diagnostic.origin}${diagnostic.path}${status}${code}${duration}`;
};
