/**
 * Single source of truth for the backend base URL.
 *
 * `VITE_API_URL` is the only supported variable name and must be supplied by
 * the environment: `.env.local` in development, the host's build settings on
 * Vercel, or a repository variable in GitHub Actions. There is deliberately no
 * fallback — a missing value fails loudly instead of shipping a bundle that
 * quietly talks to the wrong backend, which is especially costly inside the
 * Capacitor APK where the page cannot be patched afterwards.
 */
export const API_URL_ENV_VAR = 'VITE_API_URL';

/** Every backend route is mounted under this prefix. */
export const API_PATH = '/api/v1';

/**
 * Read `VITE_API_URL`. Vite inlines exactly this expression at build time, so no
 * other environment value is pulled into the bundle. The guard keeps the module
 * importable in `node --test`, where `import.meta.env` does not exist.
 */
const readApiUrlEnv = (): string | undefined => {
  try {
    return import.meta.env.VITE_API_URL;
  } catch {
    return undefined;
  }
};

const missingEnvError = (): Error =>
  new Error(
    `${API_URL_ENV_VAR} is not set. Define it as the absolute backend URL in ` +
      '.env.local, in the deployment environment, or as a GitHub Actions ' +
      'variable, for example https://<backend-host>/api/v1.'
  );

/**
 * Trim, validate and normalise an API base URL so callers can append `/path`
 * without producing `//`, and so a value given with or without `/api/v1` ends
 * up identical.
 */
export const normalizeApiBaseUrl = (value?: string | null): string => {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) throw missingEnvError();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error(
      `${API_URL_ENV_VAR} must be an absolute http(s) URL, received "${trimmed}".`
    );
  }

  const withoutTrailingSlashes = trimmed.replace(/\/+$/, '');
  return withoutTrailingSlashes.endsWith(API_PATH)
    ? withoutTrailingSlashes
    : `${withoutTrailingSlashes}${API_PATH}`;
};

/** Resolve an explicit value, or `VITE_API_URL`, into the API base URL. */
export const resolveApiBaseUrl = (value?: string | null): string =>
  normalizeApiBaseUrl(value ?? readApiUrlEnv());

/** Join an API path onto the configured base. */
export const buildApiUrl = (path: string, base: string = resolveApiBaseUrl()): string => {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${normalizeApiBaseUrl(base)}${suffix}`;
};
