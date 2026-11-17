import { OFFLINE_SCHEMA_VERSION } from '../exam/offline/schemaVersion';
import { DEFAULT_OTA_MANIFEST_BASE_URL } from './githubManifest';

/**
 * OTA build-time configuration.
 *
 * VITE_OTA_CHANNEL is baked into the web bundle used for OTA delivery and must
 * match the native build's POROKH_OTA_CHANNEL. The default is the production
 * Android channel; staging/native debug builds must override both.
 */
const env = (import.meta as { env?: Record<string, string | undefined> }).env;

export const OTA_CHANNEL =
  env?.VITE_OTA_CHANNEL?.trim() || 'production-android';

/**
 * Local exam storage schema this build can read.
 *
 * Re-exported from the storage module rather than hard-coded: the previous
 * constant claimed `1` while IndexedDB was already at version `2`, which made
 * the compatibility gate decorative.
 */
export const OTA_LOCAL_SCHEMA_VERSION = OFFLINE_SCHEMA_VERSION;

/**
 * Whether a release must carry a Capgo key-v2 signature.
 *
 * Mirrors `POROKH_OTA_REQUIRE_SIGNATURE` on the native side, so an APK that
 * embeds a public key also ships a bundle that refuses unsigned releases. The
 * flag defaults to off for local development; CI turns both on together.
 */
export const OTA_REQUIRE_SIGNATURE =
  (env?.VITE_OTA_REQUIRE_SIGNATURE ?? '').trim().toLowerCase() === 'true';

/**
 * Where signed channel pointers are published.
 *
 * Defaults to the public distribution repository; the override exists so a
 * staging deployment can be exercised without rebuilding the bundle logic.
 * Only https is accepted by the manifest reader.
 */
export const OTA_MANIFEST_BASE_URL =
  env?.VITE_OTA_MANIFEST_BASE_URL?.trim() || DEFAULT_OTA_MANIFEST_BASE_URL;

/**
 * Base64 raw (32-byte) Ed25519 public key used to verify channel pointers.
 *
 * Public material only. The private key stays in CI and never enters the app.
 * Empty means pointers cannot be authenticated, which is a rejected update when
 * `OTA_REQUIRE_SIGNATURE` is on rather than a silent skip.
 */
export const OTA_POINTER_PUBLIC_KEY =
  env?.VITE_OTA_POINTER_PUBLIC_KEY?.trim() || '';

/** Non-intrusive check cadence. */
export const OTA_INITIAL_CHECK_DELAY_MS = 4_000;
export const OTA_FOREGROUND_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Bounded retry/backoff for checks and downloads. */
export const OTA_RETRY_BASE_MS = 30_000;
export const OTA_RETRY_MAX_MS = 6 * 60 * 60 * 1000;
export const OTA_REJECT_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const OTA_MAX_DOWNLOAD_ATTEMPTS = 3;

/**
 * Only activate automatically when the app returns to the foreground and the
 * gate has stayed open for this long after startup. This gives resumed exam
 * pages time to re-register their activity first.
 */
export const OTA_ACTIVATION_GRACE_MS = 30_000;

/**
 * How long the ephemeral "update applied" success toast stays on screen
 * before it dismisses itself. Success is never persisted to storage, so this
 * in-memory timer is the only mechanism that can hide it — it must survive
 * unmounts and still fire after the WebView reload that confirms the boot.
 */
export const OTA_ACTIVATED_NOTICE_TTL_MS = 3_500;

/**
 * How long a startup health check may be deferred because local storage is
 * temporarily unavailable (as opposed to provably incompatible).
 */
export const OTA_BOOT_HEALTH_RETRY_DELAYS_MS = [0, 250, 1_000];

/** How many OTA bundles to keep on disk: the running one plus one fallback. */
export const OTA_RETAINED_BUNDLES = 2;

export const OTA_EXAM_ROUTE_PATTERNS: RegExp[] = [
  /^\/exam\/live(?:\/|$)/,
  /^\/exam\/attempt\/[^/]+(?:\/|$)/,
  /^\/exam\/challenge-play\/[^/]+(?:\/|$)/,
  /^\/admission\/exam\/[^/]+(?:\/|$)/,
  // Live group battles hold answers in memory until submission.
  /^\/groups\/[^/]+\/battles\/[^/]+(?:\/|$)/,
];
