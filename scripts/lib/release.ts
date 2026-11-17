/**
 * Reads the release inputs once so `ota-version` and `check-release` cannot
 * drift apart.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  resolveReleasePlan,
  parseGradleVersionName,
  type ReleasePlan,
  type ReleasePlanProblem,
} from '../../src/features/app-update/releasePlan.ts';
import { OFFLINE_SCHEMA_VERSION } from '../../src/features/exam/offline/schemaVersion.ts';

export type ReleaseCollection =
  | {
      ok: true;
      plan: ReleasePlan;
      /** Non-fatal observations worth printing into the job summary. */
      warnings: string[];
    }
  | { ok: false; problems: string[] };

const readJson = <T>(root: string, file: string): T | null => {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')) as T;
  } catch {
    return null;
  }
};

const gitCommitCount = (root: string): number => {
  try {
    const value = execFileSync('git', ['rev-list', '--count', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
  } catch {
    return 1;
  }
};

export const collectRelease = (
  root: string,
  env: NodeJS.ProcessEnv = process.env
): ReleaseCollection => {
  const problems: string[] = [];
  const warnings: string[] = [];

  const pkg = readJson<{ version?: string }>(root, 'package.json');
  if (!pkg) {
    return { ok: false, problems: ['package.json could not be read'] };
  }

  const policy = readJson<{ minNativeVersion?: string; schemaVersion?: number }>(
    root,
    'ota.config.json'
  );
  if (!policy) {
    return { ok: false, problems: ['ota.config.json is missing or unreadable'] };
  }

  let gradle: string;
  try {
    gradle = fs.readFileSync(
      path.join(root, 'android/app/build.gradle'),
      'utf8'
    );
  } catch {
    return {
      ok: false,
      problems: ['android/app/build.gradle is missing or unreadable'],
    };
  }

  const nativeVersionName = parseGradleVersionName(gradle);
  if (!nativeVersionName) {
    return {
      ok: false,
      problems: ['versionName not found in android/app/build.gradle'],
    };
  }

  if (
    policy.schemaVersion !== undefined &&
    policy.schemaVersion !== OFFLINE_SCHEMA_VERSION
  ) {
    problems.push(
      `ota.config.json schemaVersion (${policy.schemaVersion}) does not match the ` +
        `client schema (${OFFLINE_SCHEMA_VERSION})`
    );
  }

  const base =
    env.OTA_BASE_VERSION?.trim() ||
    String(pkg.version ?? '').split('-')[0] ||
    '';
  const channel = env.OTA_CHANNEL?.trim() || 'production-android';
  const revisionRaw = env.OTA_BUNDLE_REVISION?.trim();
  const revision = revisionRaw ? Number(revisionRaw) : gitCommitCount(root);

  if (revisionRaw && revision > gitCommitCount(root)) {
    warnings.push(
      `release revision ${revision} is ahead of the commit count; only correct for an intentional re-publish`
    );
  }

  const minNative =
    env.OTA_MIN_NATIVE_VERSION?.trim() ||
    policy.minNativeVersion?.trim() ||
    nativeVersionName;
  if (env.OTA_MIN_NATIVE_VERSION?.trim()) {
    warnings.push(
      'OTA_MIN_NATIVE_VERSION overrides ota.config.json; prefer editing the policy file'
    );
  }

  const schemaRaw = env.OTA_SCHEMA_VERSION?.trim();
  const schemaVersion = schemaRaw
    ? Number(schemaRaw)
    : (policy.schemaVersion ?? OFFLINE_SCHEMA_VERSION);

  if (schemaRaw) {
    warnings.push(
      'OTA_SCHEMA_VERSION overrides the compiled schema constant; this defeats the compatibility gate'
    );
  }

  const result = resolveReleasePlan({
    baseVersion: base,
    channel,
    revision,
    minNativeVersion: minNative,
    nativeVersionName,
    schemaVersion,
    lastPublishedVersion: env.OTA_LAST_PUBLISHED_VERSION?.trim() || null,
  });

  if (!result.ok) {
    return {
      ok: false,
      problems: result.problems.map(
        (problem: ReleasePlanProblem) => `${problem.code}: ${problem.message}`
      ),
    };
  }

  return { ok: true, plan: result.plan, warnings };
};
