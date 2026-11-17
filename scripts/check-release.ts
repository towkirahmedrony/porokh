/**
 * Pre-flight validation for an OTA release published to GitHub Releases.
 *
 * Runs before anything is uploaded and refuses to continue when the release
 * cannot be delivered safely. It never prints secret material: key checks report
 * only whether a value is present and well-formed.
 *
 * Usage:
 *   npx tsx scripts/check-release.ts            # offline validation
 *   npx tsx scripts/check-release.ts --publish  # also require publishing keys
 *
 * Exit 0 prints a `key=value` summary on stdout for $GITHUB_OUTPUT; exit 1
 * prints one `[check-release] problem: …` line per failure on stderr.
 */
import fs from 'node:fs';
import { createPrivateKey } from 'node:crypto';

import { assetNames, releaseTag } from './lib/otaPublish.ts';
import { collectRelease } from './lib/release.ts';
import {
  isValidCapgoPrivateKey,
  isValidCapgoPublicKey,
} from '../src/features/app-update/signingConfig.ts';

/** The Capgo CLI only accepts the PKCS#1 form; fail here, not mid-encryption. */
const PKCS1_HEADER = '-----BEGIN RSA PRIVATE KEY-----';

const args = new Set(process.argv.slice(2));
const publishing = args.has('--publish');

const problems: string[] = [];
const notes: string[] = [];

const collection = collectRelease(process.cwd());
if (!collection.ok) {
  for (const problem of collection.problems) problems.push(problem);
  fail();
}

const plan = collection.plan;
notes.push(...collection.warnings);

/* ----------------------------- signing policy ---------------------------- */

const requireSignature =
  (process.env.POROKH_OTA_REQUIRE_SIGNATURE ??
    process.env.OTA_REQUIRE_SIGNATURE ??
    (publishing ? 'true' : 'false')) !== 'false';

if (requireSignature) {
  const publicKey = process.env.CAPGO_PUBLIC_KEY;
  if (!publicKey) {
    problems.push(
      'CAPGO_PUBLIC_KEY is not set; bundles would be unpublishable to APKs built with signature enforcement'
    );
  } else if (!isValidCapgoPublicKey(publicKey)) {
    problems.push(
      'CAPGO_PUBLIC_KEY is not a PKCS#1 RSA public key (expected -----BEGIN RSA PUBLIC KEY-----)'
    );
  }

  /**
   * The pointer signature is a separate key: it authenticates the metadata,
   * while the RSA key above authenticates the bundle on the device.
   */
  if (!process.env.OTA_ED25519_PUBLIC_KEY?.trim()) {
    problems.push(
      'OTA_ED25519_PUBLIC_KEY is not set; the app would be unable to verify any channel pointer'
    );
  }
} else if (publishing) {
  problems.push(
    'refusing to publish with POROKH_OTA_REQUIRE_SIGNATURE=false; unsigned bundles are not accepted in production'
  );
}

if (publishing) {
  const keyPath = process.env.CAPGO_PRIVATE_KEY_PATH;
  if (!keyPath) {
    problems.push(
      'CAPGO_PRIVATE_KEY_PATH is not set; the upload would fall back to an unsigned (clear) bundle'
    );
  } else if (!fs.existsSync(keyPath)) {
    problems.push('signing key file not found at CAPGO_PRIVATE_KEY_PATH');
  } else {
    const material = fs.readFileSync(keyPath, 'utf8').trim();
    if (!isValidCapgoPrivateKey(material)) {
      problems.push('CAPGO_PRIVATE_KEY_PATH does not contain an RSA private key');
    } else if (!material.startsWith(PKCS1_HEADER)) {
      problems.push(
        `CAPGO_PRIVATE_KEY_PATH is not PKCS#1 (${PKCS1_HEADER}); the encryption step rejects PKCS#8`
      );
    } else {
      // Presence and shape only — never the value, never its length in bits.
      notes.push('RSA key-v2 signing key loaded from CAPGO_PRIVATE_KEY_PATH');
    }
  }

  const ed25519 = (process.env.OTA_ED25519_PRIVATE_KEY ?? '')
    .replace(/\\n/g, '\n')
    .trim();
  if (!ed25519) {
    problems.push(
      'OTA_ED25519_PRIVATE_KEY is not set; the channel pointer could not be signed'
    );
  } else {
    try {
      const key = createPrivateKey({ key: ed25519, format: 'pem' });
      if (key.asymmetricKeyType !== 'ed25519') {
        problems.push('OTA_ED25519_PRIVATE_KEY is not an Ed25519 private key');
      } else {
        notes.push('Ed25519 pointer signing key loaded from OTA_ED25519_PRIVATE_KEY');
      }
    } catch {
      problems.push('OTA_ED25519_PRIVATE_KEY could not be parsed as a PEM private key');
    }
  }

  if (!process.env.OTA_PUBLISH_TOKEN?.trim()) {
    problems.push(
      'OTA_PUBLISH_TOKEN is not set; the release cannot be published to the distribution repository'
    );
  }
}

if (problems.length > 0) fail();

const assets = assetNames({
  channel: plan.channel,
  baseVersion: plan.baseVersion,
  revision: plan.revision,
});

process.stdout.write(
  [
    `version=${plan.version}`,
    `base_version=${plan.baseVersion}`,
    `channel=${plan.channel}`,
    `revision=${plan.revision}`,
    `min_native_version=${plan.minNativeVersion}`,
    `native_version_name=${plan.nativeVersionName}`,
    `schema_version=${plan.schemaVersion}`,
    `signature_required=${requireSignature}`,
    `release_tag=${releaseTag(plan.channel, plan.revision)}`,
    `encrypted_asset=${assets.encrypted}`,
  ].join('\n') + '\n'
);

for (const note of notes) {
  console.error(`[check-release] note: ${note}`);
}

function fail(): never {
  for (const problem of problems) {
    console.error(`[check-release] problem: ${problem}`);
  }
  process.exit(1);
}
