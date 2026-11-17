import { OFFLINE_SCHEMA_VERSION } from '../exam/offline/schemaVersion';
import {
  buildReleaseVersion,
  compareReleaseVersions,
  compareNumericVersions,
  MAX_RELEASE_REVISION,
} from './version';

/**
 * Release planning shared by the CLI scripts and the tests.
 *
 * The previous pipeline derived every field from one value: the bundle version
 * came from `package.json`, and `minNativeVersion` defaulted to that same
 * number. A repeated build therefore produced a duplicate version, and the only
 * way to get a unique one (raise the base) also raised the native requirement,
 * which made installed APKs reject the bundle. Planning is separated here so
 * each value has one owner:
 *
 *   base version        ordering and downgrade protection (package.json)
 *   release revision    uniqueness within a base (monotonic counter or CI input)
 *   min native version  compatibility policy (`ota.config.json`)
 *   schema version      the offline store this build can read (`schemaVersion.ts`)
 */

export type ReleasePlanInput = {
  baseVersion: string;
  channel: string;
  revision: number;
  /** Minimum installed native version the bundle accepts. */
  minNativeVersion: string;
  /** The native `versionName` this build actually ships with. */
  nativeVersionName: string;
  schemaVersion?: number;
  /** Previously published versions, for duplicate / ordering checks. */
  lastPublishedVersion?: string | null;
  knownVersions?: readonly string[];
};

export type ReleasePlanProblem = {
  code:
    | 'invalid_base_version'
    | 'invalid_revision'
    | 'invalid_min_native'
    | 'min_native_ahead_of_native'
    | 'schema_mismatch'
    | 'duplicate_version'
    | 'not_increasing';
  message: string;
};

export type ReleasePlan = {
  version: string;
  baseVersion: string;
  channel: string;
  revision: number;
  minNativeVersion: string;
  nativeVersionName: string;
  schemaVersion: number;
};

export type ReleasePlanResult =
  | { ok: true; plan: ReleasePlan }
  | { ok: false; problems: ReleasePlanProblem[] };

const PLAIN_VERSION = /^\d+\.\d+\.\d+$/;
const NATIVE_VERSION = /^\d+(?:\.\d+){0,2}$/;

/** Read `versionName "1.2.3"` out of an Android `build.gradle` body. */
export const parseGradleVersionName = (gradle: string): string | null => {
  const match = /versionName\s+"([^"]+)"/.exec(gradle);
  return match ? match[1].trim() : null;
};

/** Read `versionCode 10203` out of an Android `build.gradle` body. */
export const parseGradleVersionCode = (gradle: string): number | null => {
  const match = /versionCode\s+(\d+)/.exec(gradle);
  return match ? Number(match[1]) : null;
};

export const resolveReleasePlan = (
  input: ReleasePlanInput
): ReleasePlanResult => {
  const problems: ReleasePlanProblem[] = [];
  const schemaVersion = input.schemaVersion ?? OFFLINE_SCHEMA_VERSION;

  if (!PLAIN_VERSION.test(input.baseVersion.trim())) {
    problems.push({
      code: 'invalid_base_version',
      message: `base version "${input.baseVersion}" is not plain x.y.z semver`,
    });
  }

  if (
    !Number.isInteger(input.revision) ||
    input.revision < 1 ||
    input.revision > MAX_RELEASE_REVISION
  ) {
    problems.push({
      code: 'invalid_revision',
      message: `release revision "${input.revision}" must be an integer between 1 and ${MAX_RELEASE_REVISION}`,
    });
  }

  if (!NATIVE_VERSION.test(input.minNativeVersion.trim())) {
    problems.push({
      code: 'invalid_min_native',
      message: `minimum native version "${input.minNativeVersion}" is not a version number`,
    });
  } else if (!NATIVE_VERSION.test(input.nativeVersionName.trim())) {
    problems.push({
      code: 'min_native_ahead_of_native',
      message: `native versionName "${input.nativeVersionName}" is not a version number`,
    });
  } else {
    const order = compareNumericVersions(
      input.minNativeVersion.trim(),
      input.nativeVersionName.trim()
    );
    if (order === null || order > 0) {
      problems.push({
        code: 'min_native_ahead_of_native',
        message:
          `minimum native version ${input.minNativeVersion} is newer than the ` +
          `native build being released (${input.nativeVersionName}); no installed ` +
          `APK could satisfy it`,
      });
    }
  }

  if (!Number.isInteger(schemaVersion) || schemaVersion < 1) {
    problems.push({
      code: 'schema_mismatch',
      message: `schema version "${schemaVersion}" is not a positive integer`,
    });
  }

  if (problems.length > 0) return { ok: false, problems };

  const version = buildReleaseVersion({
    baseVersion: input.baseVersion.trim(),
    channel: input.channel,
    revision: input.revision,
    minNativeVersion: input.minNativeVersion.trim(),
    requiredSchemaVersion: schemaVersion,
  });

  if (input.knownVersions?.includes(version)) {
    problems.push({
      code: 'duplicate_version',
      message: `version ${version} has already been published`,
    });
  }

  const last = input.lastPublishedVersion?.trim();
  if (last) {
    const order = compareReleaseVersions(version, last);
    if (order === null) {
      problems.push({
        code: 'not_increasing',
        message: `cannot compare "${version}" with the last published "${last}"`,
      });
    } else if (order <= 0) {
      problems.push({
        code: 'not_increasing',
        message: `${version} does not sort after the last published ${last}`,
      });
    }
  }

  if (problems.length > 0) return { ok: false, problems };

  return {
    ok: true,
    plan: {
      version,
      baseVersion: input.baseVersion.trim(),
      channel: input.channel,
      revision: input.revision,
      minNativeVersion: input.minNativeVersion.trim(),
      nativeVersionName: input.nativeVersionName.trim(),
      schemaVersion,
    },
  };
};

/** Zero-padded revision string used inside the version (e.g. `000042`). */
export const formatRevision = (revision: number): string =>
  String(revision).padStart(6, '0');
