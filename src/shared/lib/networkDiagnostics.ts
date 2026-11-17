import { API_BASE_URL } from './apiConfig';

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
export const sanitizeApiUrl = (value: string): { origin: string; path: string } => {
  try {
    const url = new URL(value, `${API_BASE_URL}/`);
    return {
      origin: url.origin,
      path: url.pathname.replace(/\/+$/, '') || '/',
    };
  } catch {
    return { origin: 'unknown', path: 'unknown' };
  }
};

export const buildNetworkDiagnostic = (input: DiagnosticInput = {}): NetworkDiagnostic => {
  const { origin, path } = sanitizeApiUrl(input.url ?? API_BASE_URL);
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
