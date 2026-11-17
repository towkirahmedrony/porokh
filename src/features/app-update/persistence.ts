import type {
  OtaBootNotice,
  OtaRejection,
  OtaRetryState,
  PendingActivation,
  StagedUpdate,
} from './types';

export interface OtaKeyValue {
  /** False when values only live in memory and cannot confirm the next boot. */
  readonly durable?: boolean;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const OTA_STORAGE_KEYS = {
  staged: 'porokh.ota.staged.v1',
  pendingActivation: 'porokh.ota.pending-activation.v1',
  checkRetry: 'porokh.ota.check-retry.v1',
  downloadRetry: 'porokh.ota.download-retry.v1',
  rejection: 'porokh.ota.rejection.v1',
  notice: 'porokh.ota.notice.v1',
  dismissedNotice: 'porokh.ota.notice-dismissed.v1',
  localSchema: 'porokh.offline.schema.v1',
} as const;

export class MemoryOtaKeyValue implements OtaKeyValue {
  private values = new Map<string, string>();

  constructor(readonly durable = true) {}

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

export class LocalStorageOtaKeyValue implements OtaKeyValue {
  readonly durable = true;

  constructor(private readonly storage: Storage) {}

  getItem(key: string): string | null {
    return this.storage.getItem(key);
  }

  setItem(key: string, value: string): void {
    this.storage.setItem(key, value);
  }

  removeItem(key: string): void {
    this.storage.removeItem(key);
  }
}

export const createOtaKeyValue = (): OtaKeyValue => {
  if (typeof window === 'undefined') return new MemoryOtaKeyValue();

  try {
    const storage = window.localStorage;
    const probe = 'porokh.ota.probe';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return new LocalStorageOtaKeyValue(storage);
  } catch {
    return new MemoryOtaKeyValue(false);
  }
};

const readJson = <T>(kv: OtaKeyValue, key: string): T | null => {
  try {
    const raw = kv.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const writeJson = (kv: OtaKeyValue, key: string, value: unknown): void => {
  try {
    kv.setItem(key, JSON.stringify(value));
  } catch {
    // Persistence is best-effort. The in-memory controller state still works
    // and the next run simply starts from idle.
  }
};

const remove = (kv: OtaKeyValue, key: string): void => {
  try {
    kv.removeItem(key);
  } catch {
    // Ignore unavailable storage.
  }
};

export const readStagedUpdate = (kv: OtaKeyValue): StagedUpdate | null => {
  const value = readJson<StagedUpdate>(kv, OTA_STORAGE_KEYS.staged);
  if (
    !value ||
    typeof value.id !== 'string' ||
    typeof value.version !== 'string' ||
    typeof value.checksum !== 'string' ||
    typeof value.stagedAt !== 'number' ||
    !value.metadata ||
    typeof value.metadata.channel !== 'string'
  ) {
    return null;
  }
  return value;
};

export const writeStagedUpdate = (kv: OtaKeyValue, value: StagedUpdate): void =>
  writeJson(kv, OTA_STORAGE_KEYS.staged, value);

export const clearStagedUpdate = (kv: OtaKeyValue): void =>
  remove(kv, OTA_STORAGE_KEYS.staged);

export const readPendingActivation = (
  kv: OtaKeyValue
): PendingActivation | null => {
  const value = readJson<PendingActivation>(kv, OTA_STORAGE_KEYS.pendingActivation);
  if (
    !value ||
    typeof value.id !== 'string' ||
    typeof value.version !== 'string' ||
    typeof value.startedAt !== 'number'
  ) {
    return null;
  }
  return value;
};

export const writePendingActivation = (
  kv: OtaKeyValue,
  value: PendingActivation
): void => writeJson(kv, OTA_STORAGE_KEYS.pendingActivation, value);

export const clearPendingActivation = (kv: OtaKeyValue): void =>
  remove(kv, OTA_STORAGE_KEYS.pendingActivation);

export const readRetryState = (
  kv: OtaKeyValue,
  key: typeof OTA_STORAGE_KEYS.checkRetry | typeof OTA_STORAGE_KEYS.downloadRetry
): OtaRetryState | null => {
  const value = readJson<OtaRetryState>(kv, key);
  if (
    !value ||
    typeof value.key !== 'string' ||
    typeof value.attempts !== 'number' ||
    typeof value.nextAt !== 'number'
  ) {
    return null;
  }
  return value;
};

export const writeRetryState = (
  kv: OtaKeyValue,
  key: typeof OTA_STORAGE_KEYS.checkRetry | typeof OTA_STORAGE_KEYS.downloadRetry,
  value: OtaRetryState
): void => writeJson(kv, key, value);

export const clearRetryState = (
  kv: OtaKeyValue,
  key: typeof OTA_STORAGE_KEYS.checkRetry | typeof OTA_STORAGE_KEYS.downloadRetry
): void => remove(kv, key);

export const readRejection = (kv: OtaKeyValue): OtaRejection | null => {
  const value = readJson<OtaRejection>(kv, OTA_STORAGE_KEYS.rejection);
  if (
    !value ||
    typeof value.version !== 'string' ||
    !Array.isArray(value.reasons) ||
    typeof value.nextAt !== 'number'
  ) {
    return null;
  }
  return value;
};

export const writeRejection = (kv: OtaKeyValue, value: OtaRejection): void =>
  writeJson(kv, OTA_STORAGE_KEYS.rejection, value);

export const readBootNotice = (kv: OtaKeyValue): OtaBootNotice | null => {
  const value = readJson<OtaBootNotice>(kv, OTA_STORAGE_KEYS.notice);
  if (
    !value ||
    (value.phase !== 'activated' &&
      value.phase !== 'activation_failed' &&
      value.phase !== 'recovery') ||
    typeof value.version !== 'string'
  ) {
    return null;
  }
  return value;
};

export const writeBootNotice = (kv: OtaKeyValue, value: OtaBootNotice): void =>
  writeJson(kv, OTA_STORAGE_KEYS.notice, value);

export const clearBootNotice = (kv: OtaKeyValue): void =>
  remove(kv, OTA_STORAGE_KEYS.notice);
