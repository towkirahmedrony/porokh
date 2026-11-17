/**
 * Pure release-publishing decisions shared by the publish script and its tests.
 *
 * Kept free of I/O so the naming, isolation and monotonicity rules can be
 * proven without a network or a repository.
 */
import { verify as ed25519Verify, type KeyObject } from 'node:crypto';
import { MAX_RELEASE_REVISION } from '../../src/features/app-update/version.ts';
import {
  POINTER_SCHEMA,
  pointerPayload,
  type ChannelPointer,
} from '../../src/features/app-update/githubManifest.ts';

export const OTA_CHANNELS = ['production-android', 'staging-android'] as const;
export type OtaChannel = (typeof OTA_CHANNELS)[number];

const CHANNEL_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export class PublishProblem extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublishProblem';
  }
}

/** Verify canonical base64 Ed25519 signatures over the exact client payload. */
export const verifyChannelPointerSignature = (input: {
  pointer: ChannelPointer;
  signature: string;
  publicKey: KeyObject;
}): boolean => {
  const encoded = input.signature.trim();
  const signature = Buffer.from(encoded, 'base64');
  if (signature.length !== 64 || signature.toString('base64') !== encoded) {
    return false;
  }

  return ed25519Verify(
    null,
    Buffer.from(pointerPayload(input.pointer), 'utf8'),
    input.publicKey,
    signature
  );
};

/** Reject anything that cannot be a channel name, before it becomes a path. */
export const assertChannel = (value: string): OtaChannel => {
  const channel = value.trim();
  if (!CHANNEL_PATTERN.test(channel)) {
    throw new PublishProblem(`invalid channel name: "${value}"`);
  }
  if (!(OTA_CHANNELS as readonly string[]).includes(channel)) {
    throw new PublishProblem(
      `unknown channel "${channel}"; expected one of ${OTA_CHANNELS.join(', ')}`
    );
  }
  return channel as OtaChannel;
};

export const formatRevision = (revision: number): string =>
  String(revision).padStart(6, '0');

/** Immutable release tag for one bundle revision. */
export const releaseTag = (channel: string, revision: number): string =>
  `ota-${channel}-r${formatRevision(revision)}`;

/** Base name of every asset of one release. */
export const bundleBaseName = (
  channel: string,
  baseVersion: string,
  revision: number
): string => `porokh-${channel}-${baseVersion}-r${formatRevision(revision)}`;

export const assetNames = (input: {
  channel: string;
  baseVersion: string;
  revision: number;
}): {
  encrypted: string;
  manifest: string;
  manifestSignature: string;
  checksums: string;
} => ({
  encrypted: `${bundleBaseName(input.channel, input.baseVersion, input.revision)}.zip.enc`,
  manifest: 'manifest.json',
  manifestSignature: 'manifest.json.sig',
  checksums: 'SHA256SUMS',
});

export const releaseAssetUrl = (input: {
  repo: string;
  channel: string;
  revision: number;
  asset: string;
}): string =>
  `https://github.com/${input.repo}/releases/download/${releaseTag(
    input.channel,
    input.revision
  )}/${input.asset}`;

/** Stable, human-auditable pointer location inside the distribution repo. */
export const channelPointerPath = (channel: string): string =>
  `channels/${channel}.json`;

export type PointerDraft = {
  channel: string;
  version: string;
  url: string;
  checksum: string;
  sessionKey: string;
  minNativeVersion: string;
  requiredSchemaVersion: number;
  revision: number;
  generation: number;
  publishedAt: string;
  notes: string;
};

/**
 * Every pointer write must advance the generation.
 *
 * This is what makes a concurrent publish detectable (the contents API rejects
 * the write with a stale blob sha) and what makes a rollback expressible without
 * pretending the bundle revision went up: the bundle may point backwards, the
 * pointer never does.
 */
export const nextGeneration = (
  current: Pick<ChannelPointer, 'generation'> | null | undefined
): number => {
  const previous = current?.generation ?? 0;
  if (!Number.isInteger(previous) || previous < 0) {
    throw new PublishProblem('current pointer has an invalid generation');
  }
  if (previous >= Number.MAX_SAFE_INTEGER) {
    throw new PublishProblem('current pointer generation cannot be incremented safely');
  }
  return previous + 1;
};

export const assertRevision = (revision: number): number => {
  if (!Number.isInteger(revision) || revision < 1 || revision > MAX_RELEASE_REVISION) {
    throw new PublishProblem(
      `invalid release revision ${revision}; expected 1-${MAX_RELEASE_REVISION}`
    );
  }
  return revision;
};

/**
 * Refuse to move a channel's pointer backwards unless the caller says so
 * explicitly, and never to a different channel's asset. Rollbacks are the one
 * legitimate backwards move, and they still need a higher generation.
 */
export const assertPointerMove = (input: {
  next: Pick<PointerDraft, 'channel' | 'revision' | 'generation' | 'url'>;
  current: ChannelPointer | null;
  allowRollback: boolean;
}): void => {
  const { next, current, allowRollback } = input;
  if (!current) return;

  if (current.channel !== next.channel) {
    throw new PublishProblem(
      `pointer channel ${current.channel} cannot be replaced by ${next.channel}`
    );
  }

  if (next.generation <= current.generation) {
    throw new PublishProblem(
      `pointer generation ${next.generation} must exceed ${current.generation}`
    );
  }

  if (next.revision < current.revision && !allowRollback) {
    throw new PublishProblem(
      `revision ${next.revision} is lower than the published ${current.revision}; ` +
        'pass --rollback-to to do this deliberately'
    );
  }
};

export const buildPointer = (draft: PointerDraft): ChannelPointer => ({
  // The same constant the reader validates against, so a schema bump is one
  // edit and not two that can drift.
  schema: POINTER_SCHEMA,
  channel: draft.channel,
  version: draft.version,
  url: draft.url,
  checksum: draft.checksum,
  sessionKey: draft.sessionKey,
  minNativeVersion: draft.minNativeVersion,
  requiredSchemaVersion: draft.requiredSchemaVersion,
  revision: draft.revision,
  generation: draft.generation,
  publishedAt: draft.publishedAt,
  notes: draft.notes,
});

/** `sha256sum -c`-compatible listing for the published assets. */
export const sha256Sums = (
  entries: Array<{ name: string; sha256: string }>
): string =>
  entries.map((entry) => `${entry.sha256}  ${entry.name}`).join('\n') + '\n';

/**
 * JSON document served as a release asset.
 *
 * Carries the same Ed25519 signature as the channel pointer, so a rollback can
 * re-verify the metadata it copies instead of trusting whatever a release asset
 * happens to contain. Without it, anyone able to create a release in the
 * distribution repository could supply a manifest whose fields the publisher
 * would then sign and hand to devices.
 */
export const manifestDocument = (
  pointer: ChannelPointer,
  signature: Buffer
): string =>
  `${JSON.stringify({ ...pointer, signature: signature.toString('base64') }, null, 2)}\n`;

/** Ed25519 signatures are published base64-encoded on a single line. */
export const signatureDocument = (signature: Buffer): string =>
  `${signature.toString('base64')}\n`;
