/**
 * Single source of truth for the offline exam storage schema.
 *
 * Three places used to disagree about this number:
 *
 *  - `storage.ts` opened IndexedDB at version 2,
 *  - the OTA client advertised schema 1 (`OTA_LOCAL_SCHEMA_VERSION`),
 *  - and the publisher defaulted every bundle to `db1`.
 *
 * The OTA activation gate compares the schema a bundle declares against the
 * schema the running build supports. When those numbers are decorative the gate
 * cannot protect anything, so `DB_VERSION`, the client constant and the
 * publisher default all read this module instead of hard-coding a literal.
 *
 * Changing this number is a native-release event: an OTA bundle must never
 * perform the upgrade alone, because IndexedDB version bumps are one-way and a
 * rollback to an older bundle would then find data it cannot open.
 */
export const OFFLINE_SCHEMA_VERSION = 2;

/**
 * Markers written by builds that labelled the store with the wrong number.
 *
 * Releases before the schema reconciliation wrote `schemaVersion: 1` while
 * IndexedDB was already at version 2, so `1` factually means "v2 with a stale
 * label". The mapping is applied only after the store opens successfully at the
 * current version, which proves the data is readable before the label is
 * corrected.
 */
export const LEGACY_SCHEMA_MARKERS: Readonly<Record<number, number>> = {
  1: 2,
};

export type SchemaMarkerResolution =
  | { status: 'current' }
  | { status: 'fresh' }
  | { status: 'legacy'; from: number; to: number }
  | { status: 'incompatible'; found: number; supported: number };

/** Classify a stored marker against the schema this build supports. */
export const resolveSchemaMarker = (
  markerVersion: number | null,
  supported: number = OFFLINE_SCHEMA_VERSION
): SchemaMarkerResolution => {
  if (markerVersion === null) return { status: 'fresh' };
  if (markerVersion === supported) return { status: 'current' };

  const migrated = LEGACY_SCHEMA_MARKERS[markerVersion];
  if (migrated === supported) {
    return { status: 'legacy', from: markerVersion, to: supported };
  }

  return { status: 'incompatible', found: markerVersion, supported };
};
