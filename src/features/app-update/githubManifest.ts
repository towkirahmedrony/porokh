/**
 * Channel pointer discovery from the public OTA distribution repository.
 *
 * This replaces the Capgo cloud `getLatest()` call. The device reads one small
 * JSON document per channel from GitHub, verifies an Ed25519 signature over its
 * canonical payload, and maps it into the existing `ProviderLatest` shape so the
 * controller keeps owning every compatibility and activation decision.
 *
 * Why the pointer is not the trust anchor: the bundle itself is authenticated
 * natively by the RSA key-v2 public key baked into the APK. The pointer
 * signature protects the *metadata* (which channel, which native floor, which
 * schema, which URL) from being rewritten/replayed by anyone who can write to
 * the distribution repository. It cannot and does not authenticate the bundle.
 *
 * Deliberate limits:
 *  - HTTPS only, and the bundle URL must live under the distribution
 *    repository's release download prefix, so a tampered pointer cannot point
 *    the APK at an arbitrary host.
 *  - Strict field validation; anything unexpected is rejected rather than
 *    coerced, so a malformed pointer can never be read as "no update".
 *  - The version string must agree with its own revision/native/schema fields,
 *    which removes the class of bug where the pair is internally inconsistent.
 *  - Never throws on transport problems: the controller turns a failure into
 *    backoff, and startup never waits on the network.
 */
import type { OtaBlockReason, ProviderLatest } from './types';
import { MAX_RELEASE_REVISION, isHttpsUrl, isSignedChecksum, parseReleaseVersion } from './version';

export const OTA_REPO = 'towkirahmedrony/porokh-ota';
export const OTA_REPO_BRANCH = 'main';
export const DEFAULT_OTA_MANIFEST_BASE_URL =
  `https://raw.githubusercontent.com/${OTA_REPO}/${OTA_REPO_BRANCH}/channels`;
export const OTA_RELEASE_ASSET_PREFIX =
  `https://github.com/${OTA_REPO}/releases/download/`;

/** Pointer document format. Bumping it is a breaking change for old clients. */
export const POINTER_SCHEMA = 1;
export const POINTER_PAYLOAD_VERSION = 'porokh-ota-pointer-v1';

const CHANNEL_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const VERSION_PATTERN = /^\d+(?:\.\d+){0,2}$/;
const SESSION_KEY_PATTERN = /^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/;
const MAX_POINTER_BYTES = 8_192;
const MAX_NOTES_LENGTH = 500;

export type ChannelPointer = {
  schema: number;
  channel: string;
  /** Full OTA release version, `1.0.2-ota.<channel>.r000123.nv1.0.1.db2`. */
  version: string;
  url: string;
  /** RSA key-v2 signed checksum, passed to the plugin unchanged. */
  checksum: string;
  /** `iv:encryptedSessionKey`, passed to the plugin unchanged. */
  sessionKey: string;
  minNativeVersion: string;
  requiredSchemaVersion: number;
  /** Bundle revision, encoded in `version` and compared by the controller. */
  revision: number;
  /** Monotonic pointer generation; every write increases it. */
  generation: number;
  publishedAt: string;
  notes: string;
};

export type SignedChannelPointer = ChannelPointer & { signature: string };

export type PointerProblem =
  | 'offline'
  | 'network_error'
  | 'http_error'
  | 'invalid_pointer'
  | 'channel_mismatch'
  | 'unsafe_url'
  | 'signature_missing'
  | 'signature_invalid'
  | 'signature_unsupported';

export type PointerParseResult =
  | { ok: true; pointer: ChannelPointer; signature: string }
  | { ok: false; problem: PointerProblem; detail?: string };

const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const isPositiveInt = (
  value: unknown,
  max = Number.MAX_SAFE_INTEGER
): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= max;

/**
 * Canonical bytes covered by the pointer signature.
 *
 * An ordered JSON array rather than an object: object key order is not part of
 * the JSON contract, so signing `JSON.stringify(object)` would make the
 * signature depend on how a writer happened to order its keys. Both the
 * publisher and this module call this one function, so there is no second
 * implementation to drift.
 */
export const pointerPayload = (pointer: ChannelPointer): string =>
  JSON.stringify([
    POINTER_PAYLOAD_VERSION,
    pointer.schema,
    pointer.channel,
    pointer.version,
    pointer.url,
    pointer.checksum,
    pointer.sessionKey,
    pointer.minNativeVersion,
    pointer.requiredSchemaVersion,
    pointer.revision,
    pointer.generation,
    pointer.publishedAt,
    pointer.notes,
  ]);

export const channelPointerUrl = (
  channel: string,
  baseUrl: string = DEFAULT_OTA_MANIFEST_BASE_URL
): string => `${baseUrl.replace(/\/+$/, '')}/${channel}.json`;

/** Validate a pointer document. Never coerces, never trusts a partial object. */
export const parseChannelPointer = (
  raw: unknown,
  options: { channel: string; assetPrefix?: string }
): PointerParseResult => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, problem: 'invalid_pointer', detail: 'not an object' };
  }

  const record = raw as Record<string, unknown>;

  if (record.schema !== POINTER_SCHEMA) {
    return { ok: false, problem: 'invalid_pointer', detail: 'unsupported schema' };
  }

  const channel = text(record.channel);
  if (!CHANNEL_PATTERN.test(channel)) {
    return { ok: false, problem: 'invalid_pointer', detail: 'invalid channel name' };
  }
  if (channel !== options.channel) {
    return {
      ok: false,
      problem: 'channel_mismatch',
      detail: `pointer is for ${channel}, expected ${options.channel}`,
    };
  }

  const version = text(record.version);
  const metadata = parseReleaseVersion(version);
  if (!metadata) {
    return { ok: false, problem: 'invalid_pointer', detail: 'invalid release version' };
  }

  const revision = record.revision;
  if (!isPositiveInt(revision, MAX_RELEASE_REVISION)) {
    return { ok: false, problem: 'invalid_pointer', detail: 'invalid revision' };
  }

  const generation = record.generation;
  if (!isPositiveInt(generation)) {
    return { ok: false, problem: 'invalid_pointer', detail: 'invalid generation' };
  }

  const minNativeVersion = text(record.minNativeVersion);
  if (!VERSION_PATTERN.test(minNativeVersion)) {
    return { ok: false, problem: 'invalid_pointer', detail: 'invalid native floor' };
  }

  const requiredSchemaVersion = record.requiredSchemaVersion;
  if (!isPositiveInt(requiredSchemaVersion)) {
    return { ok: false, problem: 'invalid_pointer', detail: 'invalid schema requirement' };
  }

  /**
   * Internal consistency. The version string is what the controller parses for
   * downgrade/native/schema decisions, so the separate fields must describe the
   * same release. A mismatch means the document was assembled wrongly (or
   * edited), and neither half can be trusted.
   */
  if (
    metadata.channel !== channel ||
    metadata.revision !== revision ||
    metadata.minNativeVersion !== minNativeVersion ||
    metadata.requiredSchemaVersion !== requiredSchemaVersion
  ) {
    return {
      ok: false,
      problem: 'invalid_pointer',
      detail: 'version fields disagree with pointer fields',
    };
  }

  const url = text(record.url);
  const assetPrefix = options.assetPrefix ?? OTA_RELEASE_ASSET_PREFIX;
  if (!isHttpsUrl(url)) {
    return { ok: false, problem: 'unsafe_url', detail: 'bundle url must be https' };
  }
  if (!url.startsWith(assetPrefix)) {
    return {
      ok: false,
      problem: 'unsafe_url',
      detail: 'bundle url is outside the distribution repository',
    };
  }

  const checksum = text(record.checksum);
  /**
   * Every release is published encrypted: the plugin rejects a clear bundle
   * once a public key is embedded, so a plain digest here would describe a
   * release this build can never install.
   */
  if (!isSignedChecksum(checksum)) {
    return { ok: false, problem: 'invalid_pointer', detail: 'checksum is not an RSA-signed block' };
  }

  const sessionKey = text(record.sessionKey);
  if (!SESSION_KEY_PATTERN.test(sessionKey)) {
    return { ok: false, problem: 'invalid_pointer', detail: 'invalid session key shape' };
  }

  const publishedAt = text(record.publishedAt);
  if (!publishedAt || Number.isNaN(Date.parse(publishedAt))) {
    return { ok: false, problem: 'invalid_pointer', detail: 'invalid publish time' };
  }

  const notes = text(record.notes);
  if (notes.length > MAX_NOTES_LENGTH) {
    return { ok: false, problem: 'invalid_pointer', detail: 'notes too long' };
  }

  return {
    ok: true,
    signature: text(record.signature),
    pointer: {
      schema: POINTER_SCHEMA,
      channel,
      version,
      url,
      checksum,
      sessionKey,
      minNativeVersion,
      requiredSchemaVersion,
      revision,
      generation,
      publishedAt,
      notes,
    },
  };
};

/* -------------------------------- Ed25519 -------------------------------- */

export type Ed25519Verifier = (
  payload: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array
) => Promise<boolean>;

/**
 * Copy bytes into a view backed by a plain ArrayBuffer.
 *
 * Web Crypto's `BufferSource` is narrower than `Uint8Array` (which may be backed
 * by a SharedArrayBuffer), so a copy is what makes the call type-safe without
 * casting the caller's data.
 */
const bufferSource = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
};

export const base64ToBytes = (value: string): Uint8Array | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const binary = atob(trimmed);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
};

/**
 * Ed25519 verification through Web Crypto.
 *
 * Returns null when the runtime has no SubtleCrypto at all; a runtime that has
 * SubtleCrypto but not Ed25519 throws from `importKey`, which the caller
 * reports as `signature_unsupported` instead of "invalid signature".
 */
export const createWebCryptoEd25519Verifier = (
  subtle: SubtleCrypto | undefined = typeof globalThis.crypto === 'undefined'
    ? undefined
    : globalThis.crypto.subtle
): Ed25519Verifier | null => {
  if (!subtle) return null;
  return async (payload, signature, publicKey) => {
    const key = await subtle.importKey(
      'raw',
      bufferSource(publicKey),
      { name: 'Ed25519' },
      false,
      ['verify']
    );
    return subtle.verify(
      { name: 'Ed25519' },
      key,
      bufferSource(signature),
      bufferSource(payload)
    );
  };
};

/* ------------------------------- discovery ------------------------------- */

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

export type ChannelLatestOptions = {
  channel: string;
  baseUrl?: string;
  assetPrefix?: string;
  /** Base64 raw (32-byte) Ed25519 public key baked into the app. */
  publicKeyBase64?: string;
  requireSignature?: boolean;
  /** `undefined` builds the Web Crypto verifier; `null` forces unsupported. */
  verifier?: Ed25519Verifier | null;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  isOnline?: () => boolean;
  now?: () => number;
};

export type ChannelLatestResult =
  | {
      ok: true;
      pointer: ChannelPointer;
      latest: ProviderLatest;
    }
  | { ok: false; problem: PointerProblem; detail?: string };

const defaultOnline = (): boolean =>
  typeof navigator === 'undefined' ? true : navigator.onLine !== false;

/**
 * Fetch and verify the pointer for one channel.
 *
 * There is deliberately no retry loop and no long timeout: the controller
 * schedules checks in the background and applies backoff, so a slow network
 * degrades to "checked later" rather than a stalled app.
 */
export const fetchChannelLatest = async (
  options: ChannelLatestOptions
): Promise<ChannelLatestResult> => {
  const isOnline = options.isOnline ?? defaultOnline;
  if (!isOnline()) return { ok: false, problem: 'offline' };

  if (!CHANNEL_PATTERN.test(options.channel)) {
    return { ok: false, problem: 'invalid_pointer', detail: 'invalid channel name' };
  }

  const baseUrl = options.baseUrl ?? DEFAULT_OTA_MANIFEST_BASE_URL;
  if (!isHttpsUrl(`${baseUrl.replace(/\/+$/, '')}/`)) {
    return { ok: false, problem: 'unsafe_url', detail: 'manifest base url must be https' };
  }

  const sourceUrl = channelPointerUrl(options.channel, baseUrl);
  const fetchImpl =
    options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike | undefined);
  if (typeof fetchImpl !== 'function') {
    return { ok: false, problem: 'network_error', detail: 'fetch unavailable' };
  }

  const timeoutMs = options.timeoutMs ?? 8_000;
  const now = options.now ?? (() => Date.now());
  const controller =
    typeof AbortController === 'undefined' ? null : new AbortController();
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const response = await fetchImpl(`${sourceUrl}?v=${now()}`, {
      cache: 'no-store',
      credentials: 'omit',
      signal: controller?.signal,
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      return {
        ok: false,
        problem: 'http_error',
        detail: `HTTP ${response.status}`,
      };
    }

    const body = await response.text();
    if (body.length > MAX_POINTER_BYTES) {
      return { ok: false, problem: 'invalid_pointer', detail: 'oversized' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return { ok: false, problem: 'invalid_pointer', detail: 'not json' };
    }

    const result = parseChannelPointer(parsed, {
      channel: options.channel,
      assetPrefix: options.assetPrefix,
    });
    if (!result.ok) return result;

    if (options.requireSignature ?? false) {
      if (!result.signature) {
        return { ok: false, problem: 'signature_missing', detail: 'pointer is unsigned' };
      }

      const publicKey = base64ToBytes(options.publicKeyBase64 ?? '');
      if (!publicKey || publicKey.length !== 32) {
        return {
          ok: false,
          problem: 'signature_unsupported',
          detail: 'pointer public key is not configured',
        };
      }

      const signature = base64ToBytes(result.signature);
      if (!signature || signature.length !== 64) {
        return { ok: false, problem: 'signature_invalid', detail: 'malformed signature' };
      }

      const verifier =
        options.verifier === undefined
          ? createWebCryptoEd25519Verifier()
          : options.verifier;
      if (!verifier) {
        return {
          ok: false,
          problem: 'signature_unsupported',
          detail: 'Ed25519 is unavailable in this runtime',
        };
      }

      let valid = false;
      try {
        valid = await verifier(
          new TextEncoder().encode(pointerPayload(result.pointer)),
          signature,
          publicKey
        );
      } catch (error) {
        return {
          ok: false,
          problem: 'signature_unsupported',
          detail: error instanceof Error ? error.message : 'Ed25519 unsupported',
        };
      }

      if (!valid) {
        return { ok: false, problem: 'signature_invalid', detail: 'signature mismatch' };
      }
    }

    return {
      ok: true,
      pointer: result.pointer,
      latest: {
        version: result.pointer.version,
        url: result.pointer.url,
        checksum: result.pointer.checksum,
        sessionKey: result.pointer.sessionKey,
      },
    };
  } catch (error) {
    const aborted =
      typeof error === 'object' &&
      error !== null &&
      (error as { name?: string }).name === 'AbortError';
    return {
      ok: false,
      problem: 'network_error',
      detail: aborted ? 'timeout' : String(error),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/**
 * Problems that must block (and cool down) a release rather than be retried.
 *
 * A transport failure is retried with backoff; a pointer that is signed wrong,
 * for another channel, or plainly malformed will not fix itself by waiting.
 */
export const pointerProblemReason = (
  problem: PointerProblem
): OtaBlockReason | null => {
  switch (problem) {
    case 'channel_mismatch':
      return 'channel_mismatch';
    case 'signature_missing':
    case 'signature_invalid':
    case 'signature_unsupported':
      return 'unsigned_bundle';
    case 'invalid_pointer':
    case 'unsafe_url':
      return 'metadata_invalid';
    default:
      return null;
  }
};

/**
 * Translate a pointer failure into the provider contract.
 *
 * Returns null for transport problems, which the adapter turns into a thrown
 * error so the controller retries with backoff instead of blocking a release
 * that may well be perfectly valid once the network returns.
 */
export const blockedLatest = (result: {
  problem: PointerProblem;
  detail?: string;
}): ProviderLatest | null => {
  const reason = pointerProblemReason(result.problem);
  if (!reason) return null;

  return {
    version: '',
    url: '',
    checksum: '',
    kind: 'blocked',
    reason,
    error: result.detail ?? result.problem,
  };
};
