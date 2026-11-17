import test from 'node:test';
import assert from 'node:assert/strict';

import { checkLocalDataHealth } from './schema.ts';
import {
  MemoryOtaKeyValue,
  OTA_STORAGE_KEYS,
  type OtaKeyValue,
} from './persistence.ts';
import { MemoryOfflineExamStorage } from '../exam/offline/storage.ts';
import { OFFLINE_SCHEMA_VERSION } from '../exam/offline/schemaVersion.ts';

const storageWithInit = (init: () => Promise<void>) =>
  ({ init }) as unknown as Parameters<typeof checkLocalDataHealth>[0];

const markerOf = (kv: OtaKeyValue): number | null => {
  const raw = kv.getItem(OTA_STORAGE_KEYS.localSchema);
  if (!raw) return null;
  return JSON.parse(raw).schemaVersion as number;
};

test('first boot writes the schema marker that matches the client constant', async () => {
  const kv = new MemoryOtaKeyValue();
  const health = await checkLocalDataHealth(new MemoryOfflineExamStorage(), kv);

  assert.deepEqual(health, { ok: true });
  assert.equal(markerOf(kv), OFFLINE_SCHEMA_VERSION);
  // The constant must describe the store that actually opens.
  assert.equal(OFFLINE_SCHEMA_VERSION, 2);
});

test('a newer schema marker blocks the update without opening the database', async () => {
  const kv = new MemoryOtaKeyValue();
  kv.setItem(
    OTA_STORAGE_KEYS.localSchema,
    JSON.stringify({ schemaVersion: 3, createdAt: '' })
  );

  let opened = 0;
  const health = await checkLocalDataHealth(
    storageWithInit(async () => {
      opened += 1;
    }),
    kv
  );

  assert.equal(health.ok, false);
  assert.equal(opened, 0, 'opening would run a one-way upgrade');
  assert.deepEqual(
    { ...health, detail: undefined },
    {
      ok: false,
      reason: 'storage_schema_incompatible',
      transient: false,
      detail: undefined,
    }
  );
});

test('a legacy v1 marker is corrected once the store opens at the current version', async () => {
  const kv = new MemoryOtaKeyValue();
  kv.setItem(
    OTA_STORAGE_KEYS.localSchema,
    JSON.stringify({ schemaVersion: 1, createdAt: '' })
  );

  const health = await checkLocalDataHealth(new MemoryOfflineExamStorage(), kv);

  assert.deepEqual(health, { ok: true, migratedFrom: 1 });
  assert.equal(markerOf(kv), OFFLINE_SCHEMA_VERSION);
});

test('a corrupt marker is treated as incompatible, never recreated silently', async () => {
  const kv = new MemoryOtaKeyValue();
  kv.setItem(OTA_STORAGE_KEYS.localSchema, '{not-json');

  const health = await checkLocalDataHealth(new MemoryOfflineExamStorage(), kv);

  assert.equal(health.ok, false);
  assert.equal(health.ok === false && health.reason, 'storage_schema_incompatible');
  assert.equal(health.ok === false && health.transient, false);
});

test('IndexedDB version errors are permanent incompatibilities', async () => {
  const kv = new MemoryOtaKeyValue();
  const health = await checkLocalDataHealth(
    storageWithInit(async () => {
      throw new Error('VersionError: requested version is lower');
    }),
    kv
  );

  assert.equal(health.ok, false);
  assert.equal(health.ok === false && health.reason, 'storage_schema_incompatible');
  assert.equal(health.ok === false && health.transient, false);
});

test('a blocked or unavailable store is transient, not a schema mismatch', async () => {
  const kv = new MemoryOtaKeyValue();
  const health = await checkLocalDataHealth(
    storageWithInit(async () => {
      throw new Error('IndexedDB open blocked');
    }),
    kv
  );

  assert.equal(health.ok, false);
  assert.equal(health.ok === false && health.reason, 'storage_unavailable');
  assert.equal(
    health.ok === false && health.transient,
    true,
    'the boot check must be allowed to retry this'
  );
});

test('an unreadable marker is transient rather than an incompatible schema', async () => {
  const brokenKv: OtaKeyValue = {
    durable: true,
    getItem: () => {
      throw new Error('localStorage disabled');
    },
    setItem: () => undefined,
    removeItem: () => undefined,
  };

  const health = await checkLocalDataHealth(
    new MemoryOfflineExamStorage(),
    brokenKv
  );

  assert.equal(health.ok, false);
  assert.equal(health.ok === false && health.reason, 'storage_unavailable');
  assert.equal(health.ok === false && health.transient, true);
});

test('a store that cannot persist the marker is reported as unavailable', async () => {
  const kv: OtaKeyValue = {
    durable: true,
    getItem: () => null,
    setItem: () => {
      throw new Error('quota exceeded');
    },
    removeItem: () => undefined,
  };

  const health = await checkLocalDataHealth(
    new MemoryOfflineExamStorage(),
    kv
  );

  assert.equal(health.ok, false);
  assert.equal(health.ok === false && health.reason, 'storage_unavailable');
  assert.equal(health.ok === false && health.transient, true);
});
