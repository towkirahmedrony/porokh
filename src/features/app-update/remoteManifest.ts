/**
 * Remote build manifest (`/version.json` on the production deployment).
 *
 * Purpose: the Android app carries a snapshot of the frontend inside the APK
 * or an OTA bundle, so `window.location` alone can never reveal that the
 * deployment has moved on. The manifest is a plain JSON document written next
 * to `index.html` at build time, so it is served by the same Vercel rewrite
 * rules as the app but is *not* the SPA fallback (a real static file always
 * wins over a rewrite).
 *
 * Deliberate limits:
 *  - JSON only, never JavaScript; nothing from it is executed.
 *  - Only three fields can influence behaviour (version, buildId, apkUrl); the
 *    rest is informational and validated but unused.
 *  - `apkUrl` must be https and is only ever opened as an intent/URL by the
 *    user's own tap.
 */
import { compareNumericVersions } from './version';

/**
 * Canonical public deployment. This is the URL the website is served from and
 * the one the version manifest is published to.
 */
export const PRODUCTION_WEB_URL = 'https://porokhbd.vercel.app';

export const VERSION_MANIFEST_PATH = '/version.json';

export type RemoteManifest = {
  version: string;
  buildId: string;
  channel: string;
  builtAt: string;
  /** Minimum installed native app version this deployment is known to work with. */
  minNativeVersion: string | null;
  /** Optional download location for a new APK build. */
  apkUrl: string | null;
};

export type ManifestFetchFailure =
  | 'offline'
  | 'network_error'
  | 'http_error'
  | 'invalid_manifest'
  | 'insecure_url';

export type ManifestFetchResult =
  | { ok: true; manifest: RemoteManifest; sourceUrl: string }
  | { ok: false; reason: ManifestFetchFailure; detail?: string };

export type BuildComparison =
  | { status: 'up_to_date'; remote: RemoteManifest }
  | { status: 'update_available'; remote: RemoteManifest }
  | { status: 'local_ahead'; remote: RemoteManifest }
  | { status: 'unknown'; remote: RemoteManifest };

const MAX_MANIFEST_BYTES = 8_192;

const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

/** https only; localhost is tolerated so `vite dev` can be exercised. */
export const isAllowedManifestUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return true;
    return (
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    );
  } catch {
    return false;
  }
};

export const manifestUrl = (baseUrl: string = PRODUCTION_WEB_URL): string =>
  `${baseUrl.replace(/\/+$/, '')}${VERSION_MANIFEST_PATH}`;

const isApkUrlUsable = (value: string): boolean =>
  value.length > 0 && value.length <= 512 && /^https:\/\//i.test(value);

/**
 * Validate a raw manifest document. Returns `null` for anything that does not
 * describe a build we can reason about, so a malformed deployment can never be
 * mistaken for "a newer version".
 */
export const parseRemoteManifest = (raw: unknown): RemoteManifest | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;

  const version = text(record.version);
  const buildId = text(record.buildId);
  if (!/^\d+\.\d+\.\d+$/.test(version)) return null;
  if (buildId.length === 0 || buildId.length > 128) return null;

  const apkUrl = text(record.apkUrl);

  return {
    version,
    buildId,
    channel: text(record.channel),
    builtAt: text(record.builtAt),
    minNativeVersion: /^\d+(?:\.\d+){0,2}$/.test(text(record.minNativeVersion))
      ? text(record.minNativeVersion)
      : null,
    apkUrl: isApkUrlUsable(apkUrl) ? apkUrl : null,
  };
};

type FetchLike = (
  input: string,
  init?: {
    cache?: string;
    credentials?: string;
    signal?: AbortSignal;
    headers?: Record<string, string>;
  }
) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}>;

export type FetchManifestOptions = {
  /** Defaults to the production deployment. */
  baseUrl?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  isOnline?: () => boolean;
  now?: () => number;
};

/**
 * Fetch and validate the deployed manifest.
 *
 * The request is deliberately uncacheable (`cache: 'no-store'` + cache-busting
 * query) so a stale HTTP cache can never report the old deployment as current,
 * and credentialed (so no cookie/authorization header is sent).
 */
export const fetchRemoteManifest = async (
  options: FetchManifestOptions = {}
): Promise<ManifestFetchResult> => {
  const isOnline =
    options.isOnline ??
    (() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  if (!isOnline()) return { ok: false, reason: 'offline' };

  const sourceUrl = manifestUrl(options.baseUrl);
  if (!isAllowedManifestUrl(sourceUrl)) {
    return { ok: false, reason: 'insecure_url' };
  }

  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  if (typeof fetchImpl !== 'function') {
    return { ok: false, reason: 'network_error', detail: 'fetch unavailable' };
  }

  const timeoutMs = options.timeoutMs ?? 8_000;
  const now = options.now ?? (() => Date.now());
  const controller =
    typeof AbortController === 'undefined' ? null : new AbortController();
  const timer = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    const response = await fetchImpl(`${sourceUrl}?t=${now()}`, {
      cache: 'no-store',
      credentials: 'omit',
      signal: controller?.signal,
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      return { ok: false, reason: 'http_error', detail: `HTTP ${response.status}` };
    }

    const body = await response.text();
    if (body.length > MAX_MANIFEST_BYTES) {
      return { ok: false, reason: 'invalid_manifest', detail: 'oversized' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return { ok: false, reason: 'invalid_manifest', detail: 'not json' };
    }

    const manifest = parseRemoteManifest(parsed);
    if (!manifest) {
      return { ok: false, reason: 'invalid_manifest' };
    }

    return { ok: true, manifest, sourceUrl };
  } catch (error) {
    const aborted =
      typeof error === 'object' &&
      error !== null &&
      (error as { name?: string }).name === 'AbortError';
    return {
      ok: false,
      reason: 'network_error',
      detail: aborted ? 'timeout' : String(error),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/**
 * Compare the running build with the deployed one.
 *
 * A different `buildId` on the same version is still an update: Vercel
 * redeploys the same semver on every commit, and only the build id changes.
 */
export const compareBuilds = (
  local: { version: string; buildId: string },
  remote: RemoteManifest
): BuildComparison => {
  if (local.buildId && remote.buildId === local.buildId) {
    return { status: 'up_to_date', remote };
  }

  const order = compareNumericVersions(remote.version, local.version);
  if (order === null) return { status: 'unknown', remote };

  if (order > 0) return { status: 'update_available', remote };
  if (order < 0) return { status: 'local_ahead', remote };

  // Same semver, different build id: every commit redeploys the same version
  // string, so a different build id is the only signal that the deployment has
  // moved on. The deployment is authoritative for the web app.
  return { status: 'update_available', remote };
};
