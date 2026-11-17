/**
 * Canonical production API endpoint. The student app is a Capacitor bundle
 * loaded from `https://localhost`, so every absolute URL must be baked in at
 * build time; a wrong host here breaks the packaged APK while the browser
 * build keeps working.
 *
 * Never change this to `porokh-backend.onrender.com`: the Render service is
 * `parapoth-backend` (the project is spelled ParaPoth, the repo is `porokh`).
 */
export const PRODUCTION_API_BASE_URL = 'https://parapoth-backend.onrender.com/api/v1';

type EnvRecord = Record<string, string | undefined>;

const readEnv = (key: string): string | undefined => {
  const env = (import.meta as ImportMeta & { env?: EnvRecord }).env;
  return env?.[key];
};

/**
 * Normalise an API base URL: trim whitespace and drop trailing slashes so
 * callers can always append `/path` without producing `//`. Empty values fall
 * back to the production endpoint, which keeps CI builds (no .env files)
 * pointing at the real backend.
 */
export const normalizeApiBaseUrl = (value?: string | null): string => {
  const trimmed = value?.trim();
  return (trimmed || PRODUCTION_API_BASE_URL).replace(/\/+$/, '');
};

/** VITE_API_URL when provided, production endpoint otherwise. */
export const resolveApiBaseUrl = (): string => normalizeApiBaseUrl(readEnv('VITE_API_URL'));

export const API_BASE_URL = resolveApiBaseUrl();

/** Join the configured base with an absolute API path. */
export const buildApiUrl = (path: string): string => {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${suffix}`;
};
