/**
 * Identity of the running frontend build.
 *
 * The Android app loads a *copy* of `dist/` that Capacitor injected into the
 * APK (or into an OTA bundle). Nothing about that copy changes when Vercel
 * redeploys the website, so the app cannot tell "the website moved on" unless
 * both sides agree on a build identity. `POROKH_BUILD` is injected by
 * `vite.config.ts` at build time and mirrored into `dist/version.json` by
 * `scripts/write-version-manifest.mjs`.
 */

export type BuildInfo = {
  /** Human semver from package.json, e.g. `1.0.0`. */
  version: string;
  /** Opaque identity of this exact build (git sha + build time). */
  buildId: string;
  /** Capgo channel this build was produced for. */
  channel: string;
  /** ISO-8601 build timestamp, empty when unknown. */
  builtAt: string;
};

export type BuildIdentityInput = Partial<BuildInfo> | undefined;

const FALLBACK_VERSION = '0.0.0';
const FALLBACK_BUILD_ID = 'dev';

const clean = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

/**
 * Normalise a build descriptor read from a build-time constant, a manifest, or
 * a test fixture. Invalid input never throws: an unidentifiable build is
 * reported as `dev` so the UI can say "unknown" instead of crashing.
 */
export const normalizeBuildInfo = (
  input: BuildIdentityInput,
  fallbackChannel = 'production-android'
): BuildInfo => ({
  version: clean(input?.version) || FALLBACK_VERSION,
  buildId: clean(input?.buildId) || FALLBACK_BUILD_ID,
  channel: clean(input?.channel) || fallbackChannel,
  builtAt: clean(input?.builtAt),
});

declare const __POROKH_BUILD__: BuildIdentityInput | undefined;

/**
 * The build this JavaScript bundle was compiled from.
 *
 * `__POROKH_BUILD__` is replaced by a frozen object literal at build time. In
 * `vite dev` it is undefined and the dev marker is used.
 */
export const currentBuild = (): BuildInfo =>
  normalizeBuildInfo(
    typeof __POROKH_BUILD__ === 'undefined' ? undefined : __POROKH_BUILD__
  );

/** Short, user-facing description of a build: `1.0.0 (a1b2c3d)`. */
export const describeBuild = (build: BuildInfo): string => {
  const shortId = build.buildId.slice(0, 7);
  return shortId && shortId !== FALLBACK_BUILD_ID
    ? `${build.version} (${shortId})`
    : build.version;
};

/** True when two builds were produced by the same source + build run. */
export const isSameBuild = (a: BuildInfo, b: BuildInfo): boolean =>
  a.buildId === b.buildId && a.buildId !== FALLBACK_BUILD_ID;
