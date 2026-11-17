/**
 * Update policy decision for the student app.
 *
 * The admin panel stores one `update_policy` document; this module turns that
 * document plus this device's three version identities into a single decision.
 * It is pure on purpose: the previous check lived inline in `SystemGuard` and
 * compared the *web bundle* version against an APK requirement, which is why
 * mandatory updates could misfire on Android.
 *
 * The three identities are never interchangeable:
 *
 *  - `websiteVersion` — what Vercel serves. Reloading the site picks it up.
 *  - `nativeVersion`  — the installed APK. Only a new APK changes it.
 *  - `otaVersion`     — the JS bundle the APK is running. Only an OTA release
 *                       changes it, and never beyond the APK's native floor.
 *
 * Mandatory APK and mandatory OTA are separate policies. An OTA update can
 * never satisfy a native requirement: the APK is the only thing that can raise
 * `nativeVersion`.
 */
import { baseVersionOf, compareNumericVersions } from './version';

export type UpdatePolicy = {
  schema: number;
  enforce_apk_update: boolean;
  min_native_version: string;
  latest_native_version: string;
  apk_download_url: string;
  enforce_ota_update: boolean;
  min_ota_version: string;
  latest_ota_version: string;
  optional_update_enabled: boolean;
  optional_update_title: string;
  optional_update_description: string;
  mandatory_update_title: string;
  mandatory_update_description: string;
  rollout_percentage: number;
};

export const DEFAULT_UPDATE_POLICY: UpdatePolicy = {
  schema: 1,
  enforce_apk_update: false,
  min_native_version: '',
  latest_native_version: '',
  apk_download_url: '',
  enforce_ota_update: false,
  min_ota_version: '',
  latest_ota_version: '',
  optional_update_enabled: false,
  optional_update_title: '',
  optional_update_description: '',
  mandatory_update_title: '',
  mandatory_update_description: '',
  rollout_percentage: 100,
};

const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

/**
 * Tolerant read of a stored policy.
 *
 * A missing or unreadable policy must never take the app offline, so every
 * unknown field falls back to "not enforced".
 */
export const normalizeUpdatePolicy = (raw: unknown): UpdatePolicy => {
  const input = (raw ?? {}) as Record<string, unknown>;
  const rollout = Number(input.rollout_percentage);

  return {
    schema: 1,
    enforce_apk_update: bool(input.enforce_apk_update, false),
    min_native_version: text(input.min_native_version),
    latest_native_version: text(input.latest_native_version),
    apk_download_url: text(input.apk_download_url),
    enforce_ota_update: bool(input.enforce_ota_update, false),
    min_ota_version: text(input.min_ota_version),
    latest_ota_version: text(input.latest_ota_version),
    optional_update_enabled: bool(input.optional_update_enabled, false),
    optional_update_title: text(input.optional_update_title),
    optional_update_description: text(input.optional_update_description),
    mandatory_update_title: text(input.mandatory_update_title),
    mandatory_update_description: text(input.mandatory_update_description),
    rollout_percentage: Number.isFinite(rollout)
      ? Math.max(0, Math.min(100, Math.round(rollout)))
      : 100,
  };
};

export type VersionIdentity = {
  /** The build this JS bundle was compiled from. */
  websiteVersion: string;
  /** Installed native APK version, null when unknown (browser or no provider). */
  nativeVersion: string | null;
  /** Currently running OTA bundle version, null when none/unknown. */
  otaVersion: string | null;
  /** True inside the Capacitor shell. */
  native: boolean;
  /** Stable per-install id, used only to bucket rollout percentages. */
  deviceId: string;
};

export type UpdateDecision =
  | { kind: 'none' }
  | {
      kind: 'optional_update';
      target: 'native';
      /** Version the device must reach to clear the prompt. */
      targetVersion: string;
      title: string;
      description: string;
      apkUrl: string | null;
    }
  | {
      kind: 'mandatory_apk';
      minVersion: string;
      title: string;
      description: string;
      apkUrl: string | null;
    }
  | {
      kind: 'mandatory_ota';
      minVersion: string;
      title: string;
      description: string;
    };

/** -1 / 0 / 1, or null when either side is not a comparable version. */
const compare = (a: string | null, b: string): number | null => {
  if (!a || !b) return null;
  return compareNumericVersions(a, b);
};

/** FNV-1a: small, deterministic, and good enough for bucketing devices. */
export const rolloutBucket = (deviceId: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < deviceId.length; index += 1) {
    hash ^= deviceId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % 100;
};

/**
 * Whether this device is inside the configured rollout.
 *
 * Mandatory policies ignore this entirely: a required update is never hidden
 * from a user based on a hash.
 */
export const inRollout = (policy: UpdatePolicy, deviceId: string): boolean => {
  if (policy.rollout_percentage >= 100) return true;
  if (policy.rollout_percentage <= 0) return false;
  return rolloutBucket(deviceId) < policy.rollout_percentage;
};

/**
 * Decide what this device should be told.
 *
 * Order matters: an APK requirement outranks an OTA requirement, because no
 * OTA bundle can run on a native binary that is too old.
 */
export const decideUpdate = (
  policy: UpdatePolicy,
  identity: VersionIdentity
): UpdateDecision => {
  const title = policy.mandatory_update_title;
  const description = policy.mandatory_update_description;

  if (!identity.native) {
    // The website is served fresh on every load; a stale tab is handled by the
    // existing hard-reload path, not by a blocking screen.
    return { kind: 'none' };
  }

  const apkOrder =
    policy.enforce_apk_update && policy.min_native_version
      ? compare(identity.nativeVersion, policy.min_native_version)
      : null;

  if (apkOrder !== null && apkOrder < 0) {
    return {
      kind: 'mandatory_apk',
      minVersion: policy.min_native_version,
      title,
      description,
      apkUrl: policy.apk_download_url || null,
    };
  }

  /**
   * The installed OTA bundle is compared by its base version, so a policy can
   * say "1.2.0 or newer" without having to track individual revisions.
   * An unidentified bundle is not proof of an old one, so it never blocks.
   */
  const installedOtaBase = baseVersionOf(identity.otaVersion);
  const otaOrder =
    policy.enforce_ota_update && policy.min_ota_version && installedOtaBase
      ? compare(installedOtaBase, policy.min_ota_version)
      : null;

  if (otaOrder !== null && otaOrder < 0) {
    return {
      kind: 'mandatory_ota',
      minVersion: policy.min_ota_version,
      title,
      description,
    };
  }

  if (!policy.optional_update_enabled || !inRollout(policy, identity.deviceId)) {
    return { kind: 'none' };
  }

  /**
   * The optional prompt targets the APK only. The website has no separate
   * "latest" field because the deployment is always the latest, and an OTA
   * release is discovered through its own signed pointer.
   */
  const optionalOrder = policy.latest_native_version
    ? compare(identity.nativeVersion, policy.latest_native_version)
    : null;

  if (optionalOrder !== null && optionalOrder < 0) {
    return {
      kind: 'optional_update',
      target: 'native',
      targetVersion: policy.latest_native_version,
      title: policy.optional_update_title,
      description: policy.optional_update_description,
      apkUrl: policy.apk_download_url || null,
    };
  }

  return { kind: 'none' };
};
