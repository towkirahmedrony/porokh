/**
 * Single source of truth for the build identity.
 *
 * `vite.config.ts` bakes this identity into the JavaScript bundle and writes the
 * same object to `dist/version.json`, so the identity compared at runtime is
 * exactly the identity that was published. Any other script that needs the
 * values imports this module instead of recomputing them.
 *
 * Resolution order:
 *  1. `POROKH_BUILD_ID` / `POROKH_BUILD_TIME` (CI, where the commit is known).
 *  2. git HEAD + the current time, memoised per process so every caller agrees.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export type BuildIdentity = {
  version: string;
  buildId: string;
  channel: string;
  builtAt: string;
};

export type VersionManifest = BuildIdentity & {
  minNativeVersion?: string;
  apkUrl?: string;
};

const gitSha = (): string => {
  try {
    return execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
};

const readPackageVersion = (root: string): string => {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, 'package.json'), 'utf8')
    ) as { version?: string };
    return String(pkg.version ?? '').trim();
  } catch {
    return '';
  }
};

let cached: BuildIdentity | null = null;

/** Resolve the identity for this build run. Memoised. */
export const resolveBuildIdentity = (root = process.cwd()): BuildIdentity => {
  if (cached) return cached;

  const version =
    process.env.POROKH_APP_VERSION?.trim() || readPackageVersion(root);

  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(
      `[build-identity] app version "${version}" is not plain x.y.z semver`
    );
  }

  const rawSha =
    process.env.POROKH_BUILD_ID?.trim() ||
    process.env.GITHUB_SHA?.trim() ||
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    gitSha();
  const builtAt =
    process.env.POROKH_BUILD_TIME?.trim() || new Date().toISOString();

  /**
   * The build id must be identical for every build of the same commit, because
   * Vercel, the APK pipeline and the OTA upload each compile `dist` separately:
   * the app compares its own id against the deployment's. A per-build timestamp
   * would make every deployment look "newer" forever.
   */
  const buildId = rawSha ? rawSha.slice(0, 12) : `t-${builtAt}`;

  cached = {
    version,
    buildId,
    channel: (process.env.POROKH_OTA_CHANNEL || 'production-android').trim(),
    builtAt,
  };

  return cached;
};

/**
 * The published manifest. Optional fields are only present when configured, so
 * the client never sees an empty string it would have to special-case.
 */
export const buildManifest = (
  identity: BuildIdentity = resolveBuildIdentity()
): VersionManifest => {
  const minNativeVersion = process.env.POROKH_MIN_NATIVE_VERSION?.trim();
  const apkUrl = process.env.POROKH_APK_URL?.trim();

  return {
    ...identity,
    ...(minNativeVersion ? { minNativeVersion } : {}),
    ...(apkUrl ? { apkUrl } : {}),
  };
};
