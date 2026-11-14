import { STORAGE_KEYS, LOCAL_STORAGE_SYNC_EVENT } from '../constants/storageKeys';
import type { StorageKey } from '../constants/storageKeys';

// Strictly enforce StorageKey or the dynamic exam progress prefix
// Removing the unsafe (string & {}) to maintain strict architectural rules
export type AnyStorageKey =
  | StorageKey
  | `${typeof STORAGE_KEYS.EXAM_PROGRESS_PREFIX}${string}`
  | `${typeof STORAGE_KEYS.SIGNUP_ONBOARDING_DRAFT_PREFIX}${string}`
  | `${typeof STORAGE_KEYS.AUTH_PROFILE_CACHE_PREFIX}${string}`;

export const StorageUtils = {
  get: <T>(key: AnyStorageKey, fallback: T | null = null): T | null => {
    if (typeof window === 'undefined') return fallback;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch (error) {
      console.warn(`Error reading storage key "${key}":`, error);
      return fallback;
    }
  },

  set: <T>(key: AnyStorageKey, value: T): void => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      window.dispatchEvent(new Event(LOCAL_STORAGE_SYNC_EVENT));
    } catch (error) {
      console.warn(`Error setting storage key "${key}":`, error);
    }
  },

  remove: (key: AnyStorageKey): void => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
      window.dispatchEvent(new Event(LOCAL_STORAGE_SYNC_EVENT));
    } catch (error) {
      console.warn(`Error removing storage key "${key}":`, error);
    }
  },

  clear: (): void => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.clear();
      window.dispatchEvent(new Event(LOCAL_STORAGE_SYNC_EVENT));
    } catch (error) {
      console.warn('Error clearing storage:', error);
    }
  }
};
