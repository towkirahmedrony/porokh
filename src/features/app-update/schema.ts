import type { OfflineExamStorage } from '../exam/offline/storage';
import { OFFLINE_SCHEMA_VERSION, resolveSchemaMarker } from '../exam/offline/schemaVersion';
import { OTA_STORAGE_KEYS, type OtaKeyValue } from './persistence';
import type { OtaBlockReason } from './types';

/**
 * The local schema marker is the only durable proof that a bundle started
 * against data it understands. It is created on first successful storage init
 * and never migrated automatically: an OTA bundle that needs a different
 * schema must ship as a native build (with a real migration) instead.
 *
 * Two things were wrong with the previous version of this check:
 *
 *  1. the marker stored `1` while the database was already at version `2`, so
 *     "compatible" was decided by a number that described nothing;
 *  2. every failure was reported as one opaque reason, so a WebView that could
 *     not open IndexedDB *yet* looked identical to data that a bundle genuinely
 *     cannot read — and the first caused an unnecessary rollback.
 *
 * Health now distinguishes:
 *   - `storage_schema_incompatible`: deterministic, non-retryable.
 *   - `storage_unavailable`: transient, retried before it is believed.
 */
type SchemaMarker = {
  schemaVersion: number;
  createdAt: string;
};

export type LocalDataHealth =
  | { ok: true; migratedFrom?: number }
  | {
      ok: false;
      reason: Extract<
        OtaBlockReason,
        'storage_unavailable' | 'storage_schema_incompatible'
      >;
      /** True when retrying later could succeed; false when it never will. */
      transient: boolean;
      detail?: string;
    };

const versionErrorPattern = /version|upgrade|schema|downgrade/i;

const parseMarker = (raw: string | null): SchemaMarker | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SchemaMarker>;
    if (typeof parsed.schemaVersion !== 'number' || !Number.isInteger(parsed.schemaVersion)) {
      return null;
    }
    return {
      schemaVersion: parsed.schemaVersion,
      createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : '',
    };
  } catch {
    return null;
  }
};

const writeMarker = (
  kv: OtaKeyValue,
  schemaVersion: number
): boolean => {
  try {
    kv.setItem(
      OTA_STORAGE_KEYS.localSchema,
      JSON.stringify({
        schemaVersion,
        createdAt: new Date().toISOString(),
      } satisfies SchemaMarker)
    );
    return true;
  } catch {
    return false;
  }
};

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const checkLocalDataHealth = async (
  storage: Pick<OfflineExamStorage, 'init'>,
  kv: OtaKeyValue,
  supportedSchemaVersion = OFFLINE_SCHEMA_VERSION
): Promise<LocalDataHealth> => {
  let rawMarker: string | null = null;

  try {
    rawMarker = kv.getItem(OTA_STORAGE_KEYS.localSchema);
  } catch (error) {
    // Reading the marker failed, which says nothing about the data itself.
    return {
      ok: false,
      reason: 'storage_unavailable',
      transient: true,
      detail: messageOf(error),
    };
  }

  const marker = parseMarker(rawMarker);

  if (rawMarker !== null && marker === null) {
    // A corrupt marker is deterministic: rewriting it would hide a real problem.
    return {
      ok: false,
      reason: 'storage_schema_incompatible',
      transient: false,
      detail: 'schema marker is unreadable',
    };
  }

  const resolution = resolveSchemaMarker(
    marker ? marker.schemaVersion : null,
    supportedSchemaVersion
  );

  /**
   * Decide *before* opening the database when the marker names a schema this
   * build cannot read. Opening first would run `onupgradeneeded` and perform a
   * one-way upgrade that the previous bundle could never undo.
   */
  if (resolution.status === 'incompatible') {
    return {
      ok: false,
      reason: 'storage_schema_incompatible',
      transient: false,
      detail: `local schema ${resolution.found} cannot be read by a build that supports ${resolution.supported}`,
    };
  }

  try {
    await storage.init();
  } catch (error) {
    const message = messageOf(error);
    const incompatible = versionErrorPattern.test(message);
    return {
      ok: false,
      reason: incompatible ? 'storage_schema_incompatible' : 'storage_unavailable',
      transient: !incompatible,
      detail: message,
    };
  }

  if (resolution.status === 'fresh') {
    if (!writeMarker(kv, supportedSchemaVersion)) {
      return {
        ok: false,
        reason: 'storage_unavailable',
        transient: true,
        detail: 'could not persist the schema marker',
      };
    }
    return { ok: true };
  }

  if (resolution.status === 'legacy') {
    // The store opened at the current version, which proves the data is
    // readable; only the label was wrong. Correct it once.
    if (!writeMarker(kv, supportedSchemaVersion)) {
      return {
        ok: false,
        reason: 'storage_unavailable',
        transient: true,
        detail: 'could not rewrite the legacy schema marker',
      };
    }
    return { ok: true, migratedFrom: resolution.from };
  }

  return { ok: true };
};
