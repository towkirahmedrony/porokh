import type { ReleaseMetadata } from './types';

/**
 * Bundle version scheme (valid semver, encoded in the prerelease field):
 *
 *   1.4.0-ota.production-android.r000042.nv1.0.0.db2
 *   │     │   │                 │        │      └ local storage schema required
 *   │     │   │                 │        └ minimum installed native version
 *   │     │   │                 └ monotonic release revision (zero padded)
 *   │     │   └ Capgo release channel
 *   │     └ OTA marker
 *   └ web base version
 *
 * Two problems drove the revision field:
 *
 *  1. `baseVersion` alone is not unique. Every build of the same package.json
 *     version produced the same string, so a second publish was rejected as a
 *     duplicate and two different commits could never be told apart.
 *  2. `minNativeVersion` used to default to `baseVersion`. Raising the base
 *     version to get a unique string therefore also raised the native
 *     requirement, and every already-installed APK rejected the bundle as
 *     `native_incompatible`.
 *
 * The revision is what makes a release unique; the base version keeps its
 * meaning (ordering / downgrade protection) and the native requirement is now
 * an independent, deliberate policy value.
 *
 * The revision is optional in the parser so a device that somehow runs a bundle
 * published by the previous scheme (`1.4.0-ota.channel.nv1.0.0.db1`) is still
 * understood instead of becoming unparseable.
 */
const RELEASE_VERSION_PATTERN =
  /^(\d+\.\d+\.\d+)-ota\.([a-z0-9][a-z0-9-]*)\.(?:r(\d{6})\.)?nv(\d+(?:\.\d+){0,2})\.db(\d+)$/;

const PLAIN_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const CHANNEL_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const NATIVE_VERSION_PATTERN = /^\d+(?:\.\d+){0,2}$/;

/** Upper bound of the zero-padded revision field (`r999999`). */
export const MAX_RELEASE_REVISION = 999_999;

export type ReleaseVersionInput = {
  baseVersion: string;
  channel: string;
  /** Monotonic publish counter. Required: uniqueness must be explicit. */
  revision: number;
  minNativeVersion: string;
  requiredSchemaVersion: number;
};

export const buildReleaseVersion = (input: ReleaseVersionInput): string => {
  const { baseVersion, channel, revision, minNativeVersion, requiredSchemaVersion } =
    input;

  if (!PLAIN_VERSION_PATTERN.test(baseVersion)) {
    throw new Error(`Invalid base version: ${baseVersion}`);
  }
  if (!CHANNEL_PATTERN.test(channel)) {
    throw new Error(`Invalid OTA channel: ${channel}`);
  }
  if (
    !Number.isInteger(revision) ||
    revision < 1 ||
    revision > MAX_RELEASE_REVISION
  ) {
    throw new Error(
      `Invalid release revision: ${revision} (expected an integer 1-${MAX_RELEASE_REVISION})`
    );
  }
  if (!NATIVE_VERSION_PATTERN.test(minNativeVersion)) {
    throw new Error(`Invalid native version: ${minNativeVersion}`);
  }
  if (!Number.isInteger(requiredSchemaVersion) || requiredSchemaVersion < 1) {
    throw new Error(`Invalid schema version: ${requiredSchemaVersion}`);
  }

  const padded = String(revision).padStart(6, '0');
  return `${baseVersion}-ota.${channel}.r${padded}.nv${minNativeVersion}.db${requiredSchemaVersion}`;
};

export const parseReleaseVersion = (
  version: string
): ReleaseMetadata | null => {
  const match = RELEASE_VERSION_PATTERN.exec(version.trim());

  if (!match) return null;

  return {
    baseVersion: match[1],
    channel: match[2],
    revision: match[3] === undefined ? null : Number(match[3]),
    minNativeVersion: match[4],
    requiredSchemaVersion: Number(match[5]),
  };
};

/** Plain (non-OTA) semver base, or the base of an OTA release version. */
export const baseVersionOf = (version: string | null | undefined): string | null => {
  if (!version) return null;
  const trimmed = version.trim();
  if (PLAIN_VERSION_PATTERN.test(trimmed)) return trimmed;
  return parseReleaseVersion(trimmed)?.baseVersion ?? null;
};

const toParts = (version: string): [number, number, number] | null => {
  const match = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(version.trim());
  if (!match) return null;

  return [
    Number(match[1]),
    Number(match[2] ?? 0),
    Number(match[3] ?? 0),
  ];
};

/** -1 when a < b, 0 when equal, 1 when a > b. */
export const compareNumericVersions = (
  a: string,
  b: string
): number | null => {
  const left = toParts(a);
  const right = toParts(b);

  if (!left || !right) return null;

  for (let index = 0; index < 3; index += 1) {
    if (left[index] < right[index]) return -1;
    if (left[index] > right[index]) return 1;
  }

  return 0;
};

/**
 * Order two release versions: base semver first, then the release revision.
 *
 * A bundle with the same base but a lower revision is older, which is what lets
 * the client reject a republished-but-older revision and lets the release
 * tooling refuse a non-increasing release.
 */
export const compareReleaseVersions = (
  a: string,
  b: string
): number | null => {
  const left = parseReleaseVersion(a);
  const right = parseReleaseVersion(b);

  if (!left || !right) return null;

  const base = compareNumericVersions(left.baseVersion, right.baseVersion);
  if (base === null || base !== 0) return base;

  return Math.sign((left.revision ?? 0) - (right.revision ?? 0));
};

/**
 * A bundle may only run on a native binary at least as new as the bundle
 * requires. Unknown/invalid installed versions are treated as incompatible so
 * an update can never be activated on an unidentified runtime.
 */
export const isNativeVersionCompatible = (
  installed: string | null,
  minimum: string
): boolean => {
  if (!installed) return false;
  const comparison = compareNumericVersions(installed, minimum);
  return comparison !== null && comparison >= 0;
};

export const isSchemaVersionCompatible = (
  required: number,
  supported: number
): boolean => Number.isInteger(required) && required === supported;

export const isHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

export const sameChecksum = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/* ------------------------------------------------------------------ *
 * Bundle signing shapes
 *
 * Capgo key v2 signs the bundle checksum with an RSA private key and ships the
 * AES session key encrypted alongside it. The device holds only the public key,
 * so a successful download proves the publisher held the private key — but only
 * if the response actually carries those fields.
 *
 * When a public key is configured, the native layer refuses an update that has
 * no session key ("Session key required when public key is present") and
 * decrypts the checksum before comparing it to the downloaded file. This module
 * mirrors those shapes so the client can reject an unsigned release before it
 * wastes a download, and so the intent is testable without a device.
 * ------------------------------------------------------------------ */

/** Plain SHA-256 digest: the shape of an unsigned (clear) release. */
export const isPlainChecksum = (value: string): boolean =>
  /^[0-9a-f]{64}$/i.test(value.trim());

/**
 * Signed (RSA-encrypted) checksum.
 *
 * Current CLIs hex-encode a whole RSA block, so the value is far longer than a
 * digest: 256 bytes → 512 hex characters for RSA-2048. Anything at or above a
 * 1024-bit block is treated as signed; a 64-character digest never is.
 */
export const isSignedChecksum = (value: string): boolean =>
  /^[0-9a-f]{128,}$/i.test(value.trim());

export type ChecksumShape = 'plain' | 'signed' | 'unknown';

export const classifyChecksum = (value: string): ChecksumShape => {
  if (isPlainChecksum(value)) return 'plain';
  if (isSignedChecksum(value)) return 'signed';
  return 'unknown';
};

/**
 * `iv:encryptedSessionKey`, mirroring `CryptoCipher.isValidSessionKey`.
 * Its presence is what distinguishes a signed release from a clear one.
 */
export const isValidSessionKey = (value: string | null | undefined): boolean => {
  if (!value) return false;
  const parts = value.split(':');
  return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
};

export type SignatureVerdict =
  | { ok: true }
  | { ok: false; reason: 'missing_session_key' | 'unsigned_checksum' };

/**
 * Decide whether a release response proves publisher authenticity.
 *
 * Only used when the build requires signatures. A clear release has neither a
 * session key nor a signed checksum, so both signals must be present.
 */
export const verifyReleaseSignature = (release: {
  checksum: string;
  sessionKey?: string | null;
}): SignatureVerdict => {
  if (!isValidSessionKey(release.sessionKey)) {
    return { ok: false, reason: 'missing_session_key' };
  }
  if (!isSignedChecksum(release.checksum)) {
    return { ok: false, reason: 'unsigned_checksum' };
  }
  return { ok: true };
};
