import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

/**
 * Installed APK version, for the `x-native-version` header.
 *
 * The backend uses it to enforce the mandatory APK policy, so it must be the
 * native version — not the web bundle's. A read failure is not cached, so a
 * later request retries instead of permanently reporting "unknown".
 */
let cached: string | null | undefined;

export const getNativeVersion = async (): Promise<string | null> => {
  if (!Capacitor.isNativePlatform()) return null;
  if (cached !== undefined) return cached;

  try {
    cached = (await App.getInfo()).version || null;
  } catch {
    return null;
  }
  return cached;
};
