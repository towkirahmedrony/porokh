import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { OFFLINE_SCHEMA_VERSION } from '../exam/offline/schemaVersion.ts';

/**
 * Static assertions about the release pipeline.
 *
 * These are not a substitute for running it, but they lock in the properties the
 * migration to GitHub Releases must keep: no Capgo cloud credential or endpoint,
 * a signed bundle and a signed pointer, a credential that never reaches argv,
 * a fail-closed path when key material is absent, pinned actions, and no manual
 * version override that would re-break native compatibility.
 */
const root = process.cwd();
const read = (file: string): string =>
  fs.readFileSync(path.join(root, file), 'utf8');

/** Strip comments so documentation about a flag is not mistaken for its use. */
const instructions = (body: string): string =>
  body
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');

const otaRelease = instructions(read('.github/workflows/ota-release.yml'));
const android = instructions(read('.github/workflows/android.yml'));
const capacitorConfig = read('capacitor.config.ts');
const publishScript = read('scripts/publish-ota-release.ts');
const checkRelease = read('scripts/check-release.ts');
const adapter = read('src/features/app-update/capgoUpdater.ts');
const manifest = read('src/features/app-update/githubManifest.ts');
const config = read('src/features/app-update/config.ts');
const otaConfig = JSON.parse(read('ota.config.json')) as {
  minNativeVersion?: string;
  schemaVersion?: number;
};
const pkg = JSON.parse(read('package.json')) as { version?: string };
const gradle = read('android/app/build.gradle');

/**
 * The Android application id is the Capgo app id, the deep-link scheme and the
 * Gradle namespace. It is read from capacitor.config.ts so a rename cannot leave
 * one of those copies behind.
 */
const appId = /appId:\s*'([^']+)'/.exec(capacitorConfig)?.[1] ?? '';
const escape = (value: string): string => value.replace(/\./g, '\\.');

test('nothing publishes to or depends on Capgo Cloud any more', () => {
  for (const needle of [
    'api.capgo.app',
    'plugin.capgo.app',
    'CAPGO_TOKEN',
    'CAPGO_API_KEY',
    '--apikey',
  ]) {
    assert.equal(
      otaRelease.includes(needle),
      false,
      `ota-release.yml still references ${needle}`
    );
    assert.equal(
      checkRelease.includes(needle),
      false,
      `check-release.ts still references ${needle}`
    );
  }

  assert.doesNotMatch(otaRelease, /bundle upload/, 'no cloud upload may remain');
  assert.doesNotMatch(checkRelease, /--registry|bundle list/, 'no cloud registry check may remain');
});

test('publishing targets the distribution repository through the publish script', () => {
  assert.match(otaRelease, /scripts\/publish-ota-release\.ts/);
  assert.match(otaRelease, /OTA_REPO: towkirahmedrony\/porokh-ota/);
  assert.match(publishScript, /releases\/download/);
  assert.match(publishScript, /contents\/\$\{channelPointerPath\(channel\)\}/);
});

test('the publish credential is scoped to the publish step and never on argv', () => {
  assert.match(otaRelease, /OTA_PUBLISH_TOKEN: \$\{\{ secrets\.OTA_PUBLISH_TOKEN \}\}/);
  assert.match(
    otaRelease,
    /OTA_TOKEN_CONFIGURED: \$\{\{ secrets\.OTA_PUBLISH_TOKEN != '' \}\}/
  );
  // The token may only appear in an env block, never inside a command.
  assert.doesNotMatch(otaRelease, /--token|Bearer \$\{?OTA_PUBLISH_TOKEN/);
  assert.doesNotMatch(publishScript, /console\.log\([^)]*token/i);
});

test('both signing keys come from secrets and never linger on the runner', () => {
  assert.match(otaRelease, /secrets\.CAPGO_PRIVATE_KEY/);
  assert.match(otaRelease, /secrets\.OTA_ED25519_PRIVATE_KEY/);
  assert.match(otaRelease, /umask 077/);
  assert.match(otaRelease, /if: always\(\)/);
  assert.match(otaRelease, /rm -f "\$RUNNER_TEMP\/capgo_key_v2"/);
  // Only the RSA key needs a file (the CLI reads a path). The Ed25519 key is
  // used in-process, so it must never be written to the runner's disk.
  assert.doesNotMatch(otaRelease, /ota-ed25519\.pem/);
  assert.doesNotMatch(otaRelease, /OTA_ED25519_KEY_PATH/);
  // The key must never be echoed or written into an artifact.
  assert.doesNotMatch(otaRelease, /echo\s+"?\$(RSA_PRIVATE_KEY|ED25519_PRIVATE_KEY)/);
});

test('the release revision is derived from the full commit history', () => {
  // `git rev-list --count HEAD` is the revision; on the default depth-1 clone
  // every publish would resolve to revision 1 and the second one would collide
  // with the existing, immutable release tag.
  assert.match(otaRelease, /fetch-depth: 0/);
});

test('release metadata is signed, and a rollback verifies it before copying', () => {
  // The manifest asset must carry the pointer signature so it is verifiable on
  // its own...
  assert.match(publishScript, /manifestDocument\(pointer, signature\)/);
  // ...and the rollback path must verify it instead of trusting the asset.
  assert.match(publishScript, /ed25519Verify\(/);
  assert.match(publishScript, /manifest signature does not verify/);
  assert.match(publishScript, /verifyChannelPointerSignature\(/);
  assert.match(publishScript, /published channel pointer signature does not verify/);
});

test('the signing keys must match the keys baked into the installed apps', () => {
  assert.match(publishScript, /does not match CAPGO_PUBLIC_KEY/);
  assert.match(publishScript, /does not match OTA_ED25519_PUBLIC_KEY/);
});

test('publishing fails closed when signing key material is missing or invalid', () => {
  assert.match(otaRelease, /CAPGO_PUBLIC_KEY must be a complete PKCS#1 RSA public key/);
  assert.match(otaRelease, /OTA_ED25519_PUBLIC_KEY must be canonical Base64 for 32 bytes/);
  assert.match(otaRelease, /RSA signing key pair is incomplete/);
  assert.match(otaRelease, /Ed25519 signing key pair is incomplete/);
  assert.match(otaRelease, /CAPGO_PRIVATE_KEY does not match CAPGO_PUBLIC_KEY/);
  assert.match(otaRelease, /OTA_ED25519_PRIVATE_KEY does not match OTA_ED25519_PUBLIC_KEY/);
  assert.match(checkRelease, /OTA_ED25519_PRIVATE_KEY is not set/);
  assert.match(checkRelease, /OTA_PUBLISH_TOKEN is not set/);
});

test('workflow actions are pinned to immutable commit SHAs', () => {
  const uses = otaRelease.match(/^\s*-?\s*uses: .+$/gm) ?? [];
  assert.ok(uses.length > 0, 'the workflow must use at least one action');

  for (const line of uses) {
    const ref = line.split('@')[1]?.split(/\s+/)[0] ?? '';
    assert.match(
      ref,
      /^[0-9a-f]{40}$/,
      `action reference "${line.trim()}" is not pinned to a commit SHA`
    );
  }
});

test('publishing is opt-in and a validation-only run is possible', () => {
  assert.match(otaRelease, /workflow_dispatch:/);
  const publishInput = /publish:\s*\n(?:.*\n)*?\s+default: false/.test(otaRelease);
  assert.equal(publishInput, true, 'dispatch must default to a dry run');
});

test('build-only and failed publisher runs are reported distinctly from verified publication', () => {
  assert.match(otaRelease, /build\/validate only \(not published\)/);
  assert.match(otaRelease, /PUBLISHED: \$\{\{ steps\.publish\.outputs\.published \|\| 'false' \}\}/);
  assert.match(otaRelease, /Publish requested/);
  assert.match(otaRelease, /Published/);

  const publisherCall = otaRelease.indexOf('scripts/publish-ota-release.ts');
  const publishedOutput = otaRelease.indexOf('echo "published=true" >> "$GITHUB_OUTPUT"');
  assert.ok(publisherCall >= 0, 'the publisher must run before success is reported');
  assert.ok(publishedOutput > publisherCall, 'Published may only be set after publisher verification exits successfully');
  assert.match(otaRelease, /Publish step failed before verified success/);
  assert.match(otaRelease, /Build and validation only; no OTA release was published/);
});

test('no manual version override can re-break native compatibility', () => {
  assert.doesNotMatch(otaRelease, /base_version:/);
  assert.doesNotMatch(otaRelease, /min_native_version:/);
  assert.match(otaRelease, /scripts\/check-release\.ts/);
});

test('the app discovers updates from the signed channel pointer, not from Capgo', () => {
  assert.doesNotMatch(
    adapter,
    /CapacitorUpdater\.getLatest\(/,
    'the cloud getLatest path must be gone'
  );
  assert.doesNotMatch(
    adapter,
    /CapacitorUpdater\.getChannel\(/,
    'channel discovery must be local'
  );
  assert.match(adapter, /fetchChannelLatest/);
  assert.match(adapter, /options\.channel \?\? OTA_CHANNEL/);

  assert.match(manifest, /raw\.githubusercontent\.com/);
  assert.match(manifest, /porokh-ota/);
  assert.match(manifest, /releases\/download/);
  assert.match(config, /OTA_MANIFEST_BASE_URL/);
  // A configured base URL that the reader ignores would silently point a
  // staging build at production pointers.
  assert.match(adapter, /baseUrl: OTA_MANIFEST_BASE_URL/);
  assert.match(config, /OTA_POINTER_PUBLIC_KEY/);
});

test('the native config keeps a rollback bundle and cannot auto-activate', () => {
  assert.match(capacitorConfig, /autoDeletePrevious: false/);
  assert.match(capacitorConfig, /autoUpdate: 'off'/);
  assert.match(capacitorConfig, /publicKey/);
  assert.match(capacitorConfig, /POROKH_OTA_REQUIRE_SIGNATURE/);
  // Statistics must not be sent to the Capgo endpoint any more.
  assert.match(capacitorConfig, /statsUrl: ''/);
});

test('the Android build embeds the keys and enforces signatures', () => {
  assert.match(android, /CAPGO_PUBLIC_KEY: \$\{\{ vars\.CAPGO_PUBLIC_KEY \}\}/);
  assert.match(android, /POROKH_OTA_REQUIRE_SIGNATURE: 'true'/);
  assert.match(android, /VITE_OTA_REQUIRE_SIGNATURE: 'true'/);
  assert.match(android, /capacitor\.config\.json/);
  assert.match(android, /packaged config has no publicKey/);
  assert.match(otaRelease, /VITE_OTA_POINTER_PUBLIC_KEY: \$\{\{ vars\.OTA_ED25519_PUBLIC_KEY \}\}/);
});

test('every APK build bakes the pointer verification key', () => {
  // An APK without the Ed25519 pointer key compiles to a client that rejects
  // every pointer as unsigned, i.e. an app that can never receive an update.
  for (const file of ['android.yml', 'build-apk.yml']) {
    const body = instructions(read(`.github/workflows/${file}`));
    assert.match(
      body,
      /VITE_OTA_POINTER_PUBLIC_KEY: \$\{\{ vars\.OTA_ED25519_PUBLIC_KEY \}\}/,
      `${file} must pass the pointer key into the web bundle`
    );
    assert.match(
      body,
      /OTA_ED25519_PUBLIC_KEY is not configured/,
      `${file} must fail closed when the pointer key is missing`
    );
    assert.match(
      body,
      /grep -rqF "\$VITE_OTA_POINTER_PUBLIC_KEY"/,
      `${file} must prove the key reached the packaged bundle`
    );
  }
});

test('the Android package matches the Capacitor app id everywhere', () => {
  assert.match(appId, /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, 'appId must be a valid application id');

  assert.match(gradle, new RegExp(`applicationId "${escape(appId)}"`));
  assert.match(gradle, new RegExp(`namespace = "${escape(appId)}"`));
  assert.match(
    read('android/app/src/main/res/values/strings.xml'),
    new RegExp(`name="package_name">${escape(appId)}<`)
  );
  assert.match(
    read('android/app/src/main/res/values/strings.xml'),
    new RegExp(`name="custom_url_scheme">${escape(appId)}<`)
  );
  assert.match(
    publishScript,
    new RegExp(`'${escape(appId)}'`),
    'the publish script must zip the same app'
  );
  assert.ok(
    fs.existsSync(
      path.join(root, 'android/app/src/main/java', ...appId.split('.'), 'MainActivity.java')
    ),
    `MainActivity must live in ${appId.split('.').join('/')}`
  );
});

test('the compatibility policy is committed and consistent', () => {
  assert.match(
    String(otaConfig.minNativeVersion),
    /^\d+\.\d+\.\d+$/,
    'minNativeVersion must be a plain version'
  );
  assert.equal(
    otaConfig.schemaVersion,
    OFFLINE_SCHEMA_VERSION,
    'ota.config.json must mirror the compiled schema constant'
  );
});

test('the native version floor can always be satisfied by the APK being built', () => {
  const versionName = /versionName\s+"([^"]+)"/.exec(gradle)?.[1] ?? '';
  const versionCode = Number(/versionCode\s+(\d+)/.exec(gradle)?.[1] ?? 0);

  assert.match(versionName, /^\d+\.\d+\.\d+$/);
  assert.equal(
    versionName,
    String(pkg.version),
    'package.json and android versionName must describe the same build'
  );
  // Play/Android require a monotonic versionCode; the script derives it from
  // major*10000 + minor*100 + patch, so 1.0.2 -> 10002.
  assert.ok(versionCode >= 10002, `versionCode ${versionCode} must increase for the rebuild`);

  const floor = String(otaConfig.minNativeVersion);
  const [floorMajor, floorMinor, floorPatch] = floor.split('.').map(Number);
  const [major, minor, patch] = versionName.split('.').map(Number);
  assert.ok(
    floorMajor * 10000 + floorMinor * 100 + floorPatch <= versionCode &&
      (floorMajor < major ||
        (floorMajor === major && floorMinor < minor) ||
        (floorMajor === major && floorMinor === minor && floorPatch <= patch)),
    `minNativeVersion ${floor} is not satisfiable by ${versionName}`
  );
});

test('no workflow file contains private key material or a token', () => {
  for (const file of [
    '.github/workflows/ota-release.yml',
    '.github/workflows/android.yml',
    '.github/workflows/ci.yml',
  ]) {
    const body = read(file);
    assert.doesNotMatch(body, /ghp_[A-Za-z0-9]{20,}/, `${file} contains a GitHub token`);
    assert.doesNotMatch(body, /github_pat_[A-Za-z0-9_]{20,}/, `${file} contains a fine-grained token`);
    // A header alone (used to validate a secret) is fine; key material is not.
    assert.doesNotMatch(
      body,
      /-----BEGIN (?:RSA )?PRIVATE KEY-----[A-Za-z0-9+/=\s]{40,}/,
      `${file} contains an embedded private key`
    );
  }
});

test('the workflow files parse as YAML', () => {
  // A hand-written check: every file starts with a name and has no tabs in
  // indentation, which is the failure mode that silently voids a workflow.
  for (const file of ['.github/workflows/ota-release.yml', '.github/workflows/android.yml']) {
    const body = read(file);
    assert.match(body, /^name: /, `${file} must start with a name`);
    for (const [index, line] of body.split('\n').entries()) {
      if (line.startsWith('\t')) {
        assert.fail(`${file}:${index + 1} uses a tab for indentation`);
      }
    }
    assert.match(body, /on:\n/, `${file} must declare triggers`);
    assert.match(body, /jobs:\n/, `${file} must declare jobs`);
  }
});
