import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { StorageUtils } from '../utils/storage';
import type { AnyStorageKey } from '../utils/storage';
import { STORAGE_KEYS } from '../constants/storageKeys';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours caching for offline support
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Persisted cache identity.
 *
 * The key carries a schema version: a bundle that changes the shape of cached
 * data must not read the previous shape back. Bump `QUERY_CACHE_VERSION` (and
 * the key) together when a cached payload changes shape; the old entry is then
 * ignored instead of crashing the dashboard on upgrade.
 */
export const QUERY_CACHE_VERSION = 2;
const PERSISTED_CACHE_KEY = `${STORAGE_KEYS.REACT_QUERY_CACHE}:v${QUERY_CACHE_VERSION}`;

/**
 * How long a persisted dashboard snapshot may be restored.
 *
 * Long enough to cover a student who is offline for several days, short enough
 * that the app never presents month-old data as "latest".
 */
export const PERSISTED_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

// Adapter to map StorageUtils to the required Storage interface safely
const storageAdapter: Storage = {
  getItem: (key: string) => {
    const data = StorageUtils.get(key as AnyStorageKey);
    // React Query expects a string back from getItem
    return data ? (typeof data === 'string' ? data : JSON.stringify(data)) : null;
  },
  setItem: (key: string, value: string) => {
    try {
      const parsedValue = JSON.parse(value);
      StorageUtils.set(key as AnyStorageKey, parsedValue);
    } catch (e) {
      StorageUtils.set(key as AnyStorageKey, value as any);
    }
  },
  removeItem: (key: string) => {
    StorageUtils.remove(key as AnyStorageKey);
  },
  clear: () => {
    if (typeof StorageUtils.clear === 'function') {
      StorageUtils.clear();
    }
  },
  key: () => null,
  length: 0,
};

export const localStoragePersister = createSyncStoragePersister({
  storage: storageAdapter,
  key: PERSISTED_CACHE_KEY,
  // A write on every cache event is unnecessary on a phone; a short throttle
  // still guarantees the snapshot is on disk before the app can be killed.
  throttleTime: 800,
});

/**
 * Drops every cached query, in memory and on disk.
 *
 * Account-scoped data (access, streaks, notification counts, profile-derived
 * dashboard state) must not survive a sign-out or an account switch on a shared
 * device. The persister is cleared explicitly because an in-memory clear alone
 * would leave the previous user's snapshot on disk for the next launch.
 */
export const purgePersistedQueryCache = (): void => {
  queryClient.clear();
  try {
    localStoragePersister.removeClient();
  } catch (error) {
    console.warn('Failed to clear the persisted query cache:', error);
  }
};
