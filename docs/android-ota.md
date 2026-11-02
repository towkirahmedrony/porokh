# Android + OTA updates

Porokh ships as a Capacitor 8 Android shell. The web app is bundled inside the
APK for first-run/offline use. Android OTA releases are immutable encrypted
GitHub Releases selected by a signed channel pointer; a website deployment is
not an Android update and never determines OTA availability. Native code,
plugins and permissions only change through a new APK/AAB.

## Update flow

1. **Discover** – the native app fetches its configured signed channel pointer
   (`channels/production-android.json` in production) on startup, foreground and
   manual checks. The pointer—not the website `version.json`—is the source of
   truth for Android OTA availability. Website build IDs and plain semver are
   not compared to OTA bundle identities.
2. **Check** – updates are not downloaded while a mounted exam page is active or
   retry backoff is active. Persisted attempts, pending submissions and unsynced
   answers block activation instead of blocking the download.
3. **Verify authenticity and metadata** – a signed release must carry both the
   RSA-encrypted checksum and the encrypted AES session key; a release without
   them is rejected before any bytes are downloaded when the build enforces
   signatures. The version string then has to match channel, minimum native
   version and local DB schema (`version.ts`), and must not be a downgrade.
4. **Download + verify** – the encrypted asset is downloaded from the GitHub
   Release selected by the pointer. The native Capacitor updater decrypts it
   with the embedded RSA key-v2 public key and compares the decrypted checksum
   against extracted files. A mismatch fails the download. The client then
   requires a real SHA-256 digest of the installed bundle and cross-checks the
   installed bundle list.
5. **Stage** – the verified bundle is persisted as staged with the *local*
   digest. Nothing reloads.
6. **Gate** – before activation, the staged bundle is checked against
   `list()` again and independent checks run:
   - runtime activity registered by exam, practice and group-battle pages,
   - persisted attempts/submissions/answers counted across **all** stored users
     (so signing out cannot hide queued work),
   - local schema health,
   - the current route as a last-resort guard.
7. **Activate** – only when every check passes, `set({ id })` is called and a
   pending marker is written first. If `set()` fails, the bundle stays staged.
8. **Confirm next boot** – `notifyAppReady()` runs only after the new bundle
   starts and local storage opens against the expected schema. A schema the
   build provably cannot read triggers `reset({ toLastSuccessful: true })` and
   no confirmation. A *transient* storage outage is retried first and, if it
   persists, the bundle is still confirmed: the bundle booted, and rolling back
   cannot repair an unavailable database.
9. **Rollback visibility** – an update that never became current is reported as
   `activation_failed`; its version is cooled down for 24 h.

Browser/PWA deployments use the website manifest and reload path. Android OTA
checks use only the signed channel pointer and its full OTA version/revision.

## Bundle retention and rollback

`autoDeletePrevious` is **false**. The plugin deleting the previous bundle the
moment the new one was confirmed left no local fallback for a regression found
after boot, so retention is decided by the controller instead:

- the running bundle,
- one most-recent other successful bundle (the rollback target),
- the `builtin` copy inside the APK, which is never deleted.

Everything else — older successful bundles and every `error` bundle — is pruned
after a confirmed boot. Bundles in `pending` (staged, awaiting activation) or
`downloading` state are never touched by pruning.

`Settings → Restore the version bundled in the APK` remains the last resort; it
drops every OTA bundle, so it should only be used when the retained fallback is
not enough.

## Offline exam data, PWA caching and OTA separation

Four storage systems exist and must not be confused:

1. **Offline exam store** (`src/features/exam/offline/`) — a versioned IndexedDB
   store (`porokh-offline-exam`) holding attempts, submissions, answers and
   complete prepared-exam datasets. Its version is
   `OFFLINE_SCHEMA_VERSION` (`schemaVersion.ts`), which is also the number the
   OTA gate and the publisher use.
2. **Server-owned exam state** — the authoritative attempt/submission state lives
   in the backend (`exam_attempts` etc., RLS + server-side ownership checks).
   The frontend `useExamResume` persists only a convenience snapshot in
   `localStorage` and always treats the backend attempt API as the source of
   truth.
3. **React Query cache** — a generic 24-hour `localStorage` query cache
   (`PersistQueryClientProvider`). It can rehydrate previously fetched data when
   connectivity drops, but it is not an offline submission queue.
4. **PWA service worker** — `public/firebase-messaging-sw.js` handles Firebase
   Cloud Messaging push only; it is not an app-shell cache and does not conflict
   with the exam store or OTA.
5. **OTA (GitHub Releases)** — native-Android-only web bundle updates; unrelated to any
   PWA asset update.

**Wiring status:** the offline exam flow is wired into the admission exam path:

- **Prepare** — `AdmissionExamCard` offers "Download offline". Preparation starts
  (or resumes) the authoritative server attempt via `POST /exams/user/attempts/start`
  and caches its frozen question set + deadline + metadata in
  `PreparedExamRecord`; an incomplete download is rejected before being marked
  ready (`prepareExamForOffline`).
- **Start/resume offline** — `useAdmissionExamSession` falls back to the prepared
  dataset when the attempt API is unreachable and the device is offline, reusing
  the same `QuestionCard` renderer and server-issued deadline (no timer reset).
- **Durable answers** — every answer change is written to `OfflineExamStorage`
  (revision-guarded, last-write-wins) so a reload/restart never loses it.
- **Submission queue** — offline (or network-failed) submissions are queued in
  `SubmissionRecord(status: 'pending')` and retried with bounded backoff by
  `syncPendingSubmissions`, which is idempotent because the backend atomically
  claims the server attempt and returns the existing result on a duplicate.
- **OTA protection** — the same persisted state blocks activation via
  `activationGate.ts`, counted across all stored users rather than only the
  signed-in one.

The attempt id is always server-issued, so offline work is never an invented
client attempt: the server has already authorized it and its deadline at prepare
time, and offline cannot extend that deadline.

## Version scheme

```
1.0.0-ota.production-android.r000042.nv1.0.0.db2
│     │   │                 │        │       └ local exam storage schema (exact match)
│     │   │                 │        └ minimum installed native version
│     │   │                 └ monotonic OTA release revision, zero padded
│     │   └ OTA channel
│     └ OTA marker
└ web base version
```

Each field has exactly one owner:

| Field | Owner | Meaning |
|---|---|---|
| base version | `package.json` | Ordering and downgrade protection. Bumped for normal releases. |
| revision | `git rev-list --count HEAD` (or `OTA_BUNDLE_REVISION`) | OTA release identity and ordering, including when the base version is unchanged. |
| `nv` | `ota.config.json` → `minNativeVersion` | Oldest APK still supported. Independent of the base version. |
| `db` | `src/features/exam/offline/schemaVersion.ts` | The store this build can read. |

Why the revision exists: the previous scheme derived everything from the base
version, so two different commits produced the same bundle version (the CLI
rejects a duplicate) and raising the base to get uniqueness also raised `nv`,
which made every installed APK reject the bundle as `native_incompatible`. A
frontend-only release no longer has to touch the native requirement.

Legacy bundles without `.r<seq>` still parse, so a device running one is
understood; they simply sort below a revisioned release of the same base.

- Native `versionName`: plain `1.0.1`; `versionCode` is `major*10000 + minor*100 + patch`
  (override with `ANDROID_VERSION_CODE`).

### The APK floor

`ota.config.json → minNativeVersion` is the oldest APK allowed to receive bundles.
It is currently **1.0.1** because 1.0.0 APKs shipped without the OTA public key:
they cannot verify a signed bundle, and handing them one would leave an
undecryptable payload behind. Those devices reject new bundles up front as
`native_incompatible` and keep running their builtin frontend until they install
a 1.0.1+ APK.

The rule that follows: **the first bundle may only be published after the APK
carrying the public key is distributed**, and `minNativeVersion` may only be
raised after an APK with that `versionName` exists. Routine frontend releases
never need to touch it.
- A bundle with `db3` never activates against local schema `2`.
- A bundle requiring `nv1.2.0` is rejected on a `1.1.x` APK.
- Bumping `OFFLINE_SCHEMA_VERSION` changes the `db` field for the next bundle,
  and that bundle is then rejected by every APK built for the older schema —
  which is the intended enforcement: **a storage migration requires an APK.**

### How the schema stays honest

`OFFLINE_SCHEMA_VERSION` is the single constant used by:

- `storage.ts` (the IndexedDB `version`),
- the OTA client's supported schema,
- the publisher (`ota.config.json` mirrors it; `ota-version` fails if they drift).

Markers written by builds that labelled the store `1` while it was already at
version `2` are migrated once, and only after the database opens successfully —
which proves the data is readable before the label is corrected. A marker that
names a schema the build cannot read is rejected **without opening** the
database, so no accidental one-way upgrade runs.

## Signing (RSA key v2 + Ed25519 pointer)

Capgo key v2 signs the bundle checksum with an RSA private key and encrypts the
AES session key with it. The APK carries only the public key, so a successful
download proves the publisher held the private key. A checksum arriving from the
same endpoint as the bundle proves nothing about who produced it — that is why
signing must be on.

Provisioning, once per project:

```bash
npx @capgo/cli key create          # writes .capgo_key_v2 (private) + .capgo_key_v2.pub
```

Both files are PKCS#1 PEM (`BEGIN RSA PUBLIC KEY` / `BEGIN RSA PRIVATE KEY`),
which is what the native parser requires. Then:

| Secret / variable | Where | Value |
|---|---|---|
| `CAPGO_PRIVATE_KEY` | repository **secret** | entire contents of `.capgo_key_v2` |
| `CAPGO_PUBLIC_KEY` | repository **variable** (not secret) | entire contents of `.capgo_key_v2.pub` |
| `OTA_ED25519_PRIVATE_KEY` | repository **secret** | Ed25519 private key that signs channel pointers; never put it in the OTA repository |
| `OTA_ED25519_PUBLIC_KEY` | repository **variable** | Base64 raw 32-byte Ed25519 public key baked into the app |
| `OTA_PUBLISH_TOKEN` | repository **secret** | Token scoped to create releases/assets and update `towkirahmedrony/porokh-ota` contents |

The RSA private key is written to `$RUNNER_TEMP` with mode 600 for the native
Capgo updater CLI and removed in an `always()` step. The Ed25519 private key is
used in memory by the publisher. Neither key nor the publish token is placed in
an artifact. Public keys are embedded in the app and checked by CI.

Both workflows set `POROKH_OTA_REQUIRE_SIGNATURE=true` and
`VITE_OTA_REQUIRE_SIGNATURE=true`. With that flag:

- a missing or malformed public key **fails the native build** instead of
  producing an APK that silently skips verification;
- the web bundle inside the APK rejects a release that carries no session key or
  no signed checksum, before downloading it.

**Rotation:** create a new pair, publish the new public key as the CI variable,
ship an APK carrying it, and only then start signing with the new private key.
Bundles signed with the old key are rejected by the new APK, so rotate together
with a release, never mid-channel.

## Channels and configuration

- Channels: `production-android` (default) and `staging-android`.
- Set `POROKH_OTA_CHANNEL` (native/cap sync) and `VITE_OTA_CHANNEL` (web bundle)
  to the same channel for staging builds.
- `ota.config.json` holds `minNativeVersion` and mirrors `schemaVersion`. Editing
  it is a deliberate compatibility decision, not a per-release override.

## Local commands

All CLIs are invoked through `node` because Termux's `/usr/bin/env` cannot run
the `node_modules/.bin` shims.

```bash
node node_modules/typescript/bin/tsc --noEmit
node node_modules/tsx/dist/cli.mjs --test <files from package.json>
node node_modules/typescript/bin/tsc && node node_modules/vite/bin/vite.js build
node node_modules/tsx/dist/cli.mjs scripts/ota-version.ts
node node_modules/tsx/dist/cli.mjs scripts/check-release.ts

node scripts/sync-native-version.mjs   # sync package.json version into build.gradle
node node_modules/@capacitor/cli/bin/capacitor sync android
node node_modules/@capacitor/cli/bin/capacitor open android
```

A local Android build needs **Java 21** and the Android SDK (Capacitor 8).
`cap sync` requires `CAPGO_PUBLIC_KEY` whenever
`POROKH_OTA_REQUIRE_SIGNATURE=true`.

## GitHub Actions

`.github/workflows/android.yml` builds a debug APK with Java 21 + the Android
SDK, refuses to build without the public key, and asserts the packaged config
carries the key, `autoDeletePrevious: false`, `autoUpdate: 'off'` and the
expected channel. It does **not** sign a release build.

`.github/workflows/ota-release.yml` runs on push to `main` **and** on manual
dispatch:

- push → build + validate only unless `OTA_AUTO_PUBLISH` is explicitly `true`;
- dispatch on `main` → publishes only when the `publish` input is enabled
  (default off), for the selected channel.

Every run: typecheck, tests, build, manifest verification, then
`scripts/check-release.ts`, which validates the version (uniqueness, ordering,
`nv ≤ versionName`, schema consistency) and signing configuration. With
`publish` on it additionally provisions and checks both signing-key pairs,
encrypts/signs the bundle, creates an immutable GitHub Release with the
encrypted bundle, signed manifest, detached signature and `SHA256SUMS`, then
updates and reads back the signed channel pointer and verifies that the asset is
publicly reachable. The workflow reports `Published=true` only after these
checks pass. A build/validation success is not an OTA release.

Required repository configuration:

- secret `CAPGO_PRIVATE_KEY`
- variable `CAPGO_PUBLIC_KEY`
- secret `OTA_ED25519_PRIVATE_KEY`
- variable `OTA_ED25519_PUBLIC_KEY`
- secret `OTA_PUBLISH_TOKEN`
- variable `OTA_AUTO_PUBLISH` (optional; only for push-triggered publishing)
- protected `production-android` and `staging-android` GitHub Environments
  (where configured)

## Operational checks

- Verify a release on a **test Supabase project** and the staging channel first.
- Keep the native APK installable: if OTA activation fails, the retained
  fallback bundle must still boot and local exam data must remain readable.
- The OTA publish workflow handles rollback by moving the signed pointer to an
  existing immutable release; the client still checks channel, revision, native
  version and schema before activating, and refuses a lower revision.
- Never bump `OFFLINE_SCHEMA_VERSION` or add Android permissions as part of an
  OTA-only release.
- A channel rollback cannot downgrade devices that already run a higher
  revision; recovering from a bad-but-confirmed bundle needs an APK or a new
  higher-revision bundle that fixes the regression.
- To publish a production frontend-only update, push the reviewed source commit
  to `main` and confirm the automatic OTA workflow is labelled build/validate
  only unless auto-publishing was deliberately enabled. Then dispatch
  **OTA release (GitHub Releases)** on `main`, select `production-android`, set
  **Publish** to true, and approve the production environment if required. Wait
  for `Published=true` and verify the release tag and signed
  `channels/production-android.json` point to the new revision. On the device,
  open **Settings → App Updates → Check now**; when the bundle is
  downloaded, choose **Download and install**. Activation remains subject to the
  exam/data safety gate. A website deployment alone never installs an Android
  OTA.
