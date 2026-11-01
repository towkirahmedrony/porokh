#!/usr/bin/env node
/**
 * Publish one immutable OTA release to the public distribution repository.
 *
 * Flow (each step fails closed):
 *   1. resolve the release plan from the repository itself (package.json +
 *      ota.config.json + android/app/build.gradle), never from a manual input
 *   2. zip `dist` and encrypt/sign it with the Capgo key-v2 RSA private key
 *   3. sign the channel pointer with the Ed25519 key
 *   4. create an immutable release and upload its four assets
 *   5. write the channel pointer with an advanced generation
 *   6. read the pointer and assets back from the public URLs
 *
 * Nothing here talks to Capgo. The private keys arrive through the environment,
 * are read into memory, and are never written to a log, an artifact or a remote
 * repository.
 *
 * Usage (run through tsx, like the other release scripts):
 *   tsx scripts/publish-ota-release.ts                     # dry run
 *   tsx scripts/publish-ota-release.ts --publish           # publish
 *   tsx scripts/publish-ota-release.ts --rollback-to ota-production-android-r000120 --publish
 *
 * Exit 0 prints a `key=value` summary on stdout; exit 1 prints one
 * `[publish-ota] problem: ...` line per failure on stderr.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign as ed25519Sign,
  verify as ed25519Verify,
} from 'node:crypto';
import { execFileSync } from 'node:child_process';

import { collectRelease } from './lib/release.ts';
import {
  PublishProblem,
  assertChannel,
  assertPointerMove,
  assertRevision,
  assetNames,
  buildPointer,
  channelPointerPath,
  formatRevision,
  manifestDocument,
  nextGeneration,
  releaseAssetUrl,
  releaseTag,
  sha256Sums,
  signatureDocument,
  type OtaChannel,
} from './lib/otaPublish.ts';
import {
  OTA_REPO,
  base64ToBytes,
  parseChannelPointer,
  pointerPayload,
  type ChannelPointer,
} from '../src/features/app-update/githubManifest.ts';

const args = new Set(process.argv.slice(2));
const publishing = args.has('--publish');
const rollbackArgIndex = process.argv.indexOf('--rollback-to');
const rollbackTo =
  rollbackArgIndex > -1 ? (process.argv[rollbackArgIndex + 1] ?? '').trim() : '';

const repo = (process.env.OTA_REPO || OTA_REPO).trim();
const token = (process.env.OTA_PUBLISH_TOKEN || '').trim();
const appId = 'net.porokh.app';
const apiBase = 'https://api.github.com';
const problems: string[] = [];
const notes: string[] = [];

const fail = (message: string): never => {
  problems.push(message);
  for (const problem of problems) {
    console.error(`[publish-ota] problem: ${problem}`);
  }
  process.exit(1);
};

const run = (command: string, argv: string[], env: NodeJS.ProcessEnv = process.env): string => {
  try {
    return execFileSync(command, argv, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
      timeout: 180_000,
    });
  } catch (error) {
    const detail =
      error && typeof error === 'object' && 'stderr' in error
        ? String((error as { stderr?: unknown }).stderr ?? '')
        : '';
    throw new PublishProblem(
      `${command} ${argv.join(' ')} failed${detail ? `: ${detail.trim().split('\n')[0]}` : ''}`
    );
  }
};

/* ------------------------------- 1. plan -------------------------------- */

let channel: OtaChannel;
try {
  channel = assertChannel(process.env.OTA_CHANNEL || 'production-android');
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

const collection = collectRelease(process.cwd());
if (!collection.ok) {
  for (const problem of collection.problems) problems.push(problem);
  fail(collection.problems[0] ?? 'release plan is invalid');
}
const plan = collection.plan;
notes.push(...collection.warnings);

if (plan.channel !== channel) {
  fail(
    `release plan channel "${plan.channel}" does not match OTA_CHANNEL "${channel}"`
  );
}

try {
  assertRevision(plan.revision);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

/* ---------------------------- 2. signing keys ---------------------------- */

const rsaKeyPath = (process.env.CAPGO_PRIVATE_KEY_PATH || '').trim();
const ed25519Pem = (process.env.OTA_ED25519_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();

if (!rsaKeyPath || !fs.existsSync(rsaKeyPath)) {
  fail('CAPGO_PRIVATE_KEY_PATH is not set to an existing key file');
}

if (!ed25519Pem) {
  fail('OTA_ED25519_PRIVATE_KEY is not configured; the pointer could not be signed');
}

let ed25519Key;
try {
  ed25519Key = createPrivateKey({ key: ed25519Pem, format: 'pem' });
  if (ed25519Key.asymmetricKeyType !== 'ed25519') {
    fail('OTA_ED25519_PRIVATE_KEY is not an Ed25519 private key');
  }
} catch (error) {
  fail(
    `OTA_ED25519_PRIVATE_KEY could not be parsed: ${
      error instanceof Error ? error.message : String(error)
    }`
  );
}

const ed25519PublicKey = createPublicKey(ed25519Key);
const ed25519PublicBase64 = (
  ed25519PublicKey.export({ type: 'spki', format: 'der' }) as Buffer
)
  .subarray(-32)
  .toString('base64');

/**
 * The signing keys must match what the installed apps already trust.
 *
 * Both mismatches are silent on the publisher side and total on the device: an
 * RSA pair that disagrees with the APK-baked public key produces a bundle no
 * device can decrypt, and an Ed25519 key that disagrees with the baked pointer
 * key makes every pointer fail verification (`signature_invalid`). Checking here
 * turns a misconfiguration into a failed run instead of a broken release.
 */
const normalizedPem = (value: string): string =>
  value.replace(/\\n/g, '\n').trim().replace(/\r\n/g, '\n');

/** DER bytes, so PEM line wrapping in a repository variable cannot differ. */
const rsaPublicDer = (key: Parameters<typeof createPublicKey>[0]): Buffer =>
  createPublicKey(key).export({ type: 'spki', format: 'der' }) as Buffer;

const configuredRsaPublic = normalizedPem(process.env.CAPGO_PUBLIC_KEY ?? '');
if (configuredRsaPublic) {
  const derived = ((): Buffer => {
    try {
      return rsaPublicDer(
        createPrivateKey({ key: fs.readFileSync(rsaKeyPath, 'utf8'), format: 'pem' })
      );
    } catch (error) {
      return fail(
        `CAPGO_PRIVATE_KEY_PATH could not be read as an RSA private key: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  })();

  const configured = ((): Buffer => {
    try {
      return rsaPublicDer({ key: configuredRsaPublic, format: 'pem' });
    } catch (error) {
      return fail(
        `CAPGO_PUBLIC_KEY could not be read as an RSA public key: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  })();

  if (!derived.equals(configured)) {
    fail(
      'CAPGO_PRIVATE_KEY does not match CAPGO_PUBLIC_KEY; the APK could not decrypt a bundle encrypted with this key'
    );
  }
}

const configuredPointerKey = (process.env.OTA_ED25519_PUBLIC_KEY ?? '').trim();
if (configuredPointerKey && configuredPointerKey !== ed25519PublicBase64) {
  fail(
    'OTA_ED25519_PRIVATE_KEY does not match OTA_ED25519_PUBLIC_KEY; every device would reject the signed pointer'
  );
}

if (!publishing) {
  notes.push('dry run: nothing is uploaded and no pointer is written');
}

const requireToken = (): string => {
  if (!publishing) return 'dry-run';
  if (!token) fail('OTA_PUBLISH_TOKEN is not configured');
  return token;
};

const api = async <T>(
  method: string,
  url: string,
  body?: unknown
): Promise<{ status: number; json: T | null }> => {
  const response = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${requireToken()}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const text = await response.text();
  let json: T | null = null;
  if (text) {
    try {
      json = JSON.parse(text) as T;
    } catch {
      json = null;
    }
  }
  return { status: response.status, json };
};

const readCurrentPointer = async (): Promise<{
  pointer: ChannelPointer | null;
  sha: string | null;
}> => {
  const url = `${apiBase}/repos/${repo}/contents/${channelPointerPath(channel)}?ref=main`;
  const { status, json } = await api<{ content?: string; sha?: string }>('GET', url);
  if (status === 404) return { pointer: null, sha: null };
  if (status !== 200 || !json?.content) {
    throw new PublishProblem(`could not read the current pointer (HTTP ${status})`);
  }

  const body = Buffer.from(json.content, 'base64').toString('utf8');
  const parsed = parseChannelPointer(JSON.parse(body), { channel });
  if (!parsed.ok) {
    throw new PublishProblem(
      `the published pointer is not a valid document (${parsed.problem}); ` +
        'refusing to replace it automatically'
    );
  }
  return { pointer: parsed.pointer, sha: json.sha ?? null };
};

const sha256 = (data: Buffer): string =>
  createHash('sha256').update(data).digest('hex');

/* ------------------------ 3. build and encrypt bundle -------------------- */

const workDir = process.env.RUNNER_TEMP || fs.mkdtempSync(path.join(process.cwd(), '.ota-'));
const cliPath = path.join('node_modules', '@capgo', 'cli', 'dist', 'index.js');

const readJsonOutput = (label: string, output: string): Record<string, unknown> => {
  const start = output.indexOf('{');
  if (start === -1) {
    throw new PublishProblem(`${label} produced no JSON output`);
  }
  try {
    return JSON.parse(output.slice(start)) as Record<string, unknown>;
  } catch {
    throw new PublishProblem(`${label} produced unparseable JSON`);
  }
};

const zipStep = publishing
  ? readJsonOutput(
      'bundle zip',
      run(process.execPath, [
        cliPath,
        'bundle',
        'zip',
        appId,
        '--path',
        'dist',
        '--bundle',
        plan.version,
        '--json',
      ])
    )
  : { checksum: 'dry-run', filename: 'dry-run.zip' };

const zipChecksum = String(zipStep.checksum ?? '');
const zipPath = String(zipStep.filename ?? '');
if (publishing) {
  if (!/^[0-9a-f]{64}$/i.test(zipChecksum)) {
    fail(`bundle zip returned an unusable checksum: "${zipChecksum}"`);
  }
  if (!zipPath || !fs.existsSync(zipPath)) {
    fail(`bundle zip did not produce ${zipPath || 'a file'}`);
  }
}

const encryptStep = publishing
  ? readJsonOutput(
      'bundle encrypt',
      run(process.execPath, [
        cliPath,
        'bundle',
        'encrypt',
        zipPath,
        zipChecksum,
        '--key',
        rsaKeyPath,
        '--json',
      ])
    )
  : { checksum: 'dry-run', filename: 'dry-run.enc', ivSessionKey: 'aXY=:a2V5' };

const signedChecksum = String(encryptStep.checksum ?? '');
const sessionKey = String(encryptStep.ivSessionKey ?? '');
const encryptedSource = String(encryptStep.filename ?? '');

if (publishing) {
  /**
   * The plugin requires an RSA-signed checksum once a public key is embedded,
   * and the client refuses anything that is not a plain digest or an RSA block.
   * A 64-character value here would mean the CLI fell back to a clear bundle.
   */
  if (!/^[0-9a-f]{128,}$/i.test(signedChecksum)) {
    fail(
      `bundle encrypt returned a ${signedChecksum.length}-character checksum; ` +
        'an RSA-signed (key-v2) checksum is required'
    );
  }
  if (!/^[^:]+:[^:]+$/.test(sessionKey)) {
    fail('bundle encrypt did not return an iv:sessionKey pair');
  }
  if (!encryptedSource || !fs.existsSync(encryptedSource)) {
    fail(`bundle encrypt did not produce ${encryptedSource || 'an encrypted bundle'}`);
  }
}

const assets = assetNames({
  channel,
  baseVersion: plan.baseVersion,
  revision: plan.revision,
});

/* ------------------------- 4. pointer and signature --------------------- */

const tag = releaseTag(channel, plan.revision);
const current = publishing ? await readCurrentPointer() : { pointer: null, sha: null };

let assetUrl = releaseAssetUrl({
  repo,
  channel,
  revision: plan.revision,
  asset: assets.encrypted,
});
let bundleVersion = plan.version;
let bundleRevision = plan.revision;
let bundleChecksum = signedChecksum;
let bundleSessionKey = sessionKey;
let bundleMinNative = plan.minNativeVersion;
let bundleSchema = plan.schemaVersion;
let notesLine = `Git ${(process.env.GITHUB_SHA || '').slice(0, 7) || 'local'}`;

if (rollbackTo) {
  if (!publishing) notes.push(`dry run: would roll the pointer back to ${rollbackTo}`);
  const releaseUrl = `https://github.com/${repo}/releases/download/${rollbackTo}/manifest.json`;
  const response = await fetch(releaseUrl, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    fail(`rollback target ${rollbackTo} has no readable manifest.json (HTTP ${response.status})`);
  }
  const parsed = parseChannelPointer(await response.json(), { channel });
  if (!parsed.ok) {
    fail(`rollback target ${rollbackTo} is not a valid pointer (${parsed.problem})`);
  }

  /**
   * The target manifest is signed by us; require that signature rather than
   * copying whatever metadata the asset contains.
   */
  const rollbackSignature = base64ToBytes(parsed.signature);
  if (!rollbackSignature || rollbackSignature.length !== 64) {
    fail(`rollback target ${rollbackTo} carries no usable Ed25519 signature`);
  }
  const rollbackSignatureValid = ed25519Verify(
    null,
    Buffer.from(pointerPayload(parsed.pointer), 'utf8'),
    ed25519PublicKey,
    Buffer.from(rollbackSignature)
  );
  if (!rollbackSignatureValid) {
    fail(`rollback target ${rollbackTo} manifest signature does not verify`);
  }
  if (parsed.pointer.revision >= plan.revision) {
    fail(
      `rollback target revision ${parsed.pointer.revision} is not older than ${plan.revision}`
    );
  }
  assetUrl = parsed.pointer.url;
  bundleVersion = parsed.pointer.version;
  bundleRevision = parsed.pointer.revision;
  bundleChecksum = parsed.pointer.checksum;
  bundleSessionKey = parsed.pointer.sessionKey;
  bundleMinNative = parsed.pointer.minNativeVersion;
  bundleSchema = parsed.pointer.requiredSchemaVersion;
  notesLine = `Rollback to ${rollbackTo} (${parsed.pointer.version})`;
  notes.push('rollback: devices already on a newer bundle will refuse this as a downgrade');
}

const generation = nextGeneration(current.pointer);
const pointer = buildPointer({
  channel,
  version: bundleVersion,
  url: assetUrl,
  checksum: bundleChecksum,
  sessionKey: bundleSessionKey,
  minNativeVersion: bundleMinNative,
  requiredSchemaVersion: bundleSchema,
  revision: bundleRevision,
  generation,
  publishedAt: new Date().toISOString(),
  notes: notesLine,
});

try {
  assertPointerMove({ next: pointer, current: current.pointer, allowRollback: Boolean(rollbackTo) });
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

const signature = ed25519Sign(null, Buffer.from(pointerPayload(pointer), 'utf8'), ed25519Key);
const pointerDocument = { ...pointer, signature: signature.toString('base64') };

if (!publishing) {
  const summary = {
    channel,
    tag,
    version: pointer.version,
    revision: pointer.revision,
    generation: pointer.generation,
    asset: assets.encrypted,
    url: pointer.url,
    keys: { rsa: 'provisioned', ed25519Public: ed25519PublicBase64 },
    notes,
  };
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

/* ----------------------------- 5. publish ------------------------------- */

const encryptedPath = path.join(workDir, assets.encrypted);
fs.copyFileSync(encryptedSource, encryptedPath);

const manifestBytes = Buffer.from(manifestDocument(pointer, signature), 'utf8');
const signatureBytes = Buffer.from(signatureDocument(signature), 'utf8');
const checksumBytes = Buffer.from(
  sha256Sums([
    { name: assets.encrypted, sha256: sha256(fs.readFileSync(encryptedPath)) },
    { name: assets.manifest, sha256: sha256(manifestBytes) },
    { name: assets.manifestSignature, sha256: sha256(signatureBytes) },
  ]),
  'utf8'
);

const uploadFiles: Array<{ name: string; data: Buffer; type: string }> = [
  { name: assets.encrypted, data: fs.readFileSync(encryptedPath), type: 'application/octet-stream' },
  { name: assets.manifest, data: manifestBytes, type: 'application/json' },
  { name: assets.manifestSignature, data: signatureBytes, type: 'text/plain' },
  { name: assets.checksums, data: checksumBytes, type: 'text/plain' },
];

if (!rollbackTo) {
  const created = await api<{ id?: number; tag_name?: string }>(
    'POST',
    `${apiBase}/repos/${repo}/releases`,
    {
      tag_name: tag,
      target_commitish: 'main',
      name: `${channel} ${plan.baseVersion} r${formatRevision(plan.revision)}`,
      body: [
        `Signed OTA bundle for \`${channel}\`.`,
        '',
        `- version: \`${pointer.version}\``,
        `- revision: \`${pointer.revision}\``,
        `- native floor: \`${pointer.minNativeVersion}\``,
        `- schema: \`${pointer.requiredSchemaVersion}\``,
        `- commit: \`${process.env.GITHUB_SHA || 'local'}\``,
      ].join('\n'),
      draft: false,
      prerelease: channel !== 'production-android',
    }
  );

  if (created.status === 422) {
    fail(`release tag ${tag} already exists; versions are immutable and never overwritten`);
  }
  if ((created.status !== 201 && created.status !== 200) || !created.json?.id) {
    fail(`could not create release ${tag} (HTTP ${created.status})`);
  }

  const releaseId = created.json.id;
  for (const file of uploadFiles) {
    const response = await fetch(
      `https://uploads.github.com/repos/${repo}/releases/${releaseId}/assets?name=${encodeURIComponent(file.name)}`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${requireToken()}`,
          accept: 'application/vnd.github+json',
          'x-github-api-version': '2022-11-28',
          'content-type': file.type,
        },
        body: file.data,
      }
    );
    if (!response.ok) {
      fail(`uploading ${file.name} failed (HTTP ${response.status})`);
    }
  }
}

/* --------------------------- 6. channel pointer ------------------------- */

const pointerBody = `${JSON.stringify(pointerDocument, null, 2)}\n`;
const putPointer = await api<{ commit?: { sha?: string } }>(
  'PUT',
  `${apiBase}/repos/${repo}/contents/${channelPointerPath(channel)}`,
  {
    message: `ota(${channel}): ${pointer.version} (generation ${pointer.generation})`,
    content: Buffer.from(pointerBody, 'utf8').toString('base64'),
    branch: 'main',
    ...(current.sha ? { sha: current.sha } : {}),
  }
);

if (putPointer.status !== 200 && putPointer.status !== 201) {
  fail(`could not update the channel pointer (HTTP ${putPointer.status})`);
}

const publicKeyPath = `keys/ed25519-public.pem`;
const pemBody = createPublicKey(ed25519Key)
  .export({ type: 'spki', format: 'pem' })
  .toString()
  .trim();

const existingKey = await api<{ sha?: string; content?: string }>(
  'GET',
  `${apiBase}/repos/${repo}/contents/${publicKeyPath}?ref=main`
);
const existingKeyBody =
  existingKey.status === 200 && existingKey.json?.content
    ? Buffer.from(existingKey.json.content, 'base64').toString('utf8').trim()
    : null;

if (existingKeyBody && existingKeyBody !== pemBody.trim()) {
  fail(
    'keys/ed25519-public.pem does not match the signing key; refusing to publish a ' +
      'pointer signed by an unexpected key'
  );
}

  if (!existingKeyBody) {
  const putKey = await api(
    'PUT',
    `${apiBase}/repos/${repo}/contents/${publicKeyPath}`,
    {
      message: 'keys: publish Ed25519 pointer verification key',
      content: Buffer.from(`${pemBody}\n`, 'utf8').toString('base64'),
      branch: 'main',
    }
  );
  if (putKey.status !== 200 && putKey.status !== 201) {
    fail(`could not publish the Ed25519 public key (HTTP ${putKey.status})`);
  }
}

/* ------------------------------ 7. verify ------------------------------- */

const verifyPointer = await fetch(
  `https://raw.githubusercontent.com/${repo}/main/${channelPointerPath(channel)}?v=${Date.now()}`,
  { headers: { accept: 'application/json' } }
);
if (!verifyPointer.ok) {
  fail(`published pointer is not readable (HTTP ${verifyPointer.status})`);
}

const verified = parseChannelPointer(await verifyPointer.json(), { channel });
if (!verified.ok) {
  fail(`published pointer is invalid (${verified.problem})`);
}
if (
  verified.pointer.version !== pointer.version ||
  verified.pointer.generation !== pointer.generation
) {
  fail('published pointer does not match the release that was just written');
}
if (verified.signature !== pointerDocument.signature) {
  fail('published pointer signature does not match');
}

if (!rollbackTo) {
  const assetCheck = await fetch(pointer.url, { headers: { range: 'bytes=0-0' } });
  if (!assetCheck.ok) {
    fail(`published bundle asset is not readable (HTTP ${assetCheck.status})`);
  }
}

console.log(
  [
    `channel=${channel}`,
    `tag=${rollbackTo || tag}`,
    `version=${pointer.version}`,
    `revision=${pointer.revision}`,
    `generation=${pointer.generation}`,
    // Derived from the pointer so a rollback reports the asset it actually
    // points at, not the one this run would have built.
    `asset=${pointer.url.split('/').pop() ?? assets.encrypted}`,
    `url=${pointer.url}`,
    `rollback=${rollbackTo || 'none'}`,
  ].join('\n')
);
for (const note of notes) {
  console.error(`[publish-ota] note: ${note}`);
}
