/**
 * Cache recovery for the browser build.
 *
 * Scope is deliberately narrow. A stale frontend cache is an HTTP-Cache,
 * Cache-Storage and service-worker problem; exam data is *not* cached there.
 * This module therefore never touches:
 *
 *  - IndexedDB (`porokh-offline-exam`: attempts, answers, submissions),
 *  - localStorage (language, theme, queued offline work, OTA state),
 *  - sessionStorage, except the single reload marker defined below.
 *
 * Deleting a Cache Storage bucket cannot lose an exam attempt, and clearing
 * HTTP caches for a document request only forces a revalidation of static
 * assets, which is exactly what a "hard reload" is supposed to do.
 */
import type { BuildInfo } from './buildInfo';

export const RELOAD_MARKER_KEY = 'porokh.update.pending-reload.v1';
export const RELOAD_PARAM = 'porokh_reload';

export type CachePurgeReport = {
  /** Cache Storage buckets that were removed. */
  deletedCaches: string[];
  /** True when the Cache Storage API was unavailable or refused to run. */
  skipped: boolean;
  /** A waiting service worker was told to activate. */
  workerActivated: boolean;
  /** A service worker update check ran successfully. */
  workerChecked: boolean;
};

type CachesLike = { keys: () => Promise<string[]>; delete: (key: string) => Promise<boolean> };

type ServiceWorkerLike = {
  getRegistrations?: () => Promise<
    Array<{
      update?: () => Promise<unknown>;
      waiting?: { postMessage: (message: unknown) => void } | null;
    }>
  >;
};

export type PurgeOptions = {
  cacheStorage?: CachesLike | null;
  serviceWorker?: ServiceWorkerLike | null;
};

/**
 * Remove runtime caches and activate a waiting service worker.
 *
 * Only Cache Storage is touched; every failure is swallowed and reported, so a
 * locked-down WebView still reaches the reload step instead of throwing.
 */
export const purgeFrontendCaches = async (
  options: PurgeOptions = {}
): Promise<CachePurgeReport> => {
  const report: CachePurgeReport = {
    deletedCaches: [],
    skipped: false,
    workerActivated: false,
    workerChecked: false,
  };

  const cacheStorage =
    options.cacheStorage ??
    (typeof caches === 'undefined' ? null : (caches as unknown as CachesLike));

  if (!cacheStorage || typeof cacheStorage.keys !== 'function') {
    report.skipped = true;
  } else {
    try {
      const keys = await cacheStorage.keys();
      for (const key of keys) {
        try {
          if (await cacheStorage.delete(key)) report.deletedCaches.push(key);
        } catch {
          // A single undeletable bucket must not stop the rest.
        }
      }
    } catch {
      report.skipped = true;
    }
  }

  const serviceWorker =
    options.serviceWorker ??
    (typeof navigator === 'undefined'
      ? null
      : (navigator.serviceWorker as unknown as ServiceWorkerLike | undefined));

  if (serviceWorker && typeof serviceWorker.getRegistrations === 'function') {
    try {
      const registrations = await serviceWorker.getRegistrations();
      for (const registration of registrations) {
        try {
          await registration.update?.();
          report.workerChecked = true;
        } catch {
          // Offline or blocked: the reload below still revalidates the document.
        }

        if (registration.waiting) {
          try {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            report.workerActivated = true;
          } catch {
            // Ignore a worker that refuses to activate.
          }
        }
      }
    } catch {
      // getRegistrations can throw in private mode; nothing to recover there.
    }
  }

  return report;
};

export type PendingReload = {
  /** Build the reload is meant to land on. */
  targetBuildId: string;
  targetVersion: string;
  /** Build that was running when the reload started. */
  fromBuildId: string;
  at: number;
};

const safeSession = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export const writePendingReload = (
  value: PendingReload,
  storage: Storage | null = safeSession()
): void => {
  try {
    storage?.setItem(RELOAD_MARKER_KEY, JSON.stringify(value));
  } catch {
    // Verification degrades to "unknown"; the reload itself must still happen.
  }
};

export const readPendingReload = (
  storage: Storage | null = safeSession()
): PendingReload | null => {
  try {
    const raw = storage?.getItem(RELOAD_MARKER_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PendingReload>;
    if (
      typeof value.targetBuildId !== 'string' ||
      typeof value.targetVersion !== 'string' ||
      typeof value.at !== 'number'
    ) {
      return null;
    }
    return {
      targetBuildId: value.targetBuildId,
      targetVersion: value.targetVersion,
      fromBuildId: typeof value.fromBuildId === 'string' ? value.fromBuildId : '',
      at: value.at,
    };
  } catch {
    return null;
  }
};

export const clearPendingReload = (
  storage: Storage | null = safeSession()
): void => {
  try {
    storage?.removeItem(RELOAD_MARKER_KEY);
  } catch {
    // Ignore unavailable storage.
  }
};

export type ReloadOutcome =
  | { kind: 'verified'; build: BuildInfo }
  | { kind: 'still_stale'; build: BuildInfo; expectedBuildId: string };

/**
 * After a reload, confirm that the bundle actually changed.
 *
 * Returns `null` when there is no marker, or when the marker is older than
 * `maxAgeMs` (a reload that never happened must not be reported as success).
 */
export const resolveReloadOutcome = (
  build: BuildInfo,
  options: { pending?: PendingReload | null; now?: number; maxAgeMs?: number } = {}
): ReloadOutcome | null => {
  const pending = options.pending ?? readPendingReload();
  if (!pending) return null;

  const now = options.now ?? Date.now();
  const maxAgeMs = options.maxAgeMs ?? 10 * 60 * 1000;
  if (!Number.isFinite(pending.at) || now - pending.at > maxAgeMs) return null;

  if (build.buildId === pending.targetBuildId) {
    return { kind: 'verified', build };
  }

  return { kind: 'still_stale', build, expectedBuildId: pending.targetBuildId };
};

const stripParam = (search: string, param: string): string => {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  params.delete(param);
  const rest = params.toString();
  return rest ? `?${rest}` : '';
};

/**
 * Reload the current document from the network, bypassing every cache layer.
 *
 * The cache-busting query is removed on the next boot by `stripReloadMarker`,
 * so the URL the user sees does not accumulate state.
 */
export const reloadFromNetwork = (options: {
  location: Pick<Location, 'href' | 'origin' | 'pathname' | 'search' | 'hash'>;
  now?: number;
}): string => {
  const { location } = options;
  const now = options.now ?? Date.now();
  const search = stripParam(location.search, RELOAD_PARAM);
  const query = search ? `${search}&${RELOAD_PARAM}=${now}` : `?${RELOAD_PARAM}=${now}`;
  const target = `${location.origin}${location.pathname}${query}${location.hash}`;
  location.href = target;
  return target;
};

/** Remove the cache-busting query parameter after a reload. */
export const stripReloadMarker = (options: {
  location: Pick<Location, 'pathname' | 'search' | 'hash'>;
  history?: Pick<History, 'replaceState'>;
}): void => {
  const { location } = options;
  if (!location.search.includes(RELOAD_PARAM)) return;
  const search = stripParam(location.search, RELOAD_PARAM);
  const next = `${location.pathname}${search}${location.hash}`;
  try {
    options.history?.replaceState(null, '', next);
  } catch {
    // Non-fatal: the parameter is harmless if it stays.
  }
};
