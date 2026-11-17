/**
 * Print the Capgo bundle version for the current build.
 *
 * Inputs (all optional):
 *   OTA_BASE_VERSION            web base semver (default: package.json version)
 *   OTA_CHANNEL                 Capgo channel (default: production-android)
 *   OTA_BUNDLE_REVISION         monotonic release counter
 *                               (default: `git rev-list --count HEAD`)
 *   OTA_MIN_NATIVE_VERSION      override of ota.config.json minNativeVersion
 *   OTA_SCHEMA_VERSION          override of the client offline schema version
 *   OTA_LAST_PUBLISHED_VERSION  previous release, for ordering enforcement
 *
 * Exit codes: 0 success (version on stdout), 1 problem (reasons on stderr).
 *
 * The version is deterministic: the same commit always yields the same string,
 * and a later commit always yields a higher one. That replaces the old
 * behaviour where every build of the same package.json version produced an
 * identical bundle version and the second publish was rejected as a duplicate.
 */
import { collectRelease } from './lib/release.ts';

const result = collectRelease(process.cwd());

if (!result.ok) {
  for (const problem of result.problems) {
    console.error(`[ota-version] ${problem}`);
  }
  process.exit(1);
}

for (const warning of result.warnings) {
  console.error(`[ota-version] warning: ${warning}`);
}

process.stdout.write(`${result.plan.version}\n`);
