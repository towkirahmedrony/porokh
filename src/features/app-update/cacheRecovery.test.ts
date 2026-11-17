import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RELOAD_MARKER_KEY,
  clearPendingReload,
  purgeFrontendCaches,
  readPendingReload,
  reloadFromNetwork,
  resolveReloadOutcome,
  stripReloadMarker,
  writePendingReload,
} from './cacheRecovery.ts';
import { normalizeBuildInfo } from './buildInfo.ts';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

const fakeCaches = (keys: string[], failing: string[] = []) => {
  const deleted: string[] = [];
  return {
    deleted,
    storage: {
      keys: async () => keys,
      delete: async (key: string) => {
        if (failing.includes(key)) throw new Error('locked');
        deleted.push(key);
        return true;
      },
    },
  };
};

test('purgeFrontendCaches deletes every Cache Storage bucket', async () => {
  const { deleted, storage } = fakeCaches(['porokh-shell', 'firebase']);

  const report = await purgeFrontendCaches({ cacheStorage: storage });

  assert.deepEqual(deleted, ['porokh-shell', 'firebase']);
  assert.deepEqual(report.deletedCaches, ['porokh-shell', 'firebase']);
  assert.equal(report.skipped, false);
});

test('purgeFrontendCaches reports skipped when Cache Storage is unavailable', async () => {
  const report = await purgeFrontendCaches({ cacheStorage: null });
  assert.equal(report.skipped, true);
  assert.deepEqual(report.deletedCaches, []);
});

test('one undeletable bucket does not stop the others', async () => {
  const { deleted, storage } = fakeCaches(['a', 'b'], ['a']);

  const report = await purgeFrontendCaches({ cacheStorage: storage });

  assert.deepEqual(deleted, ['b']);
  assert.deepEqual(report.deletedCaches, ['b']);
});

test('a waiting service worker is asked to activate', async () => {
  const messages: unknown[] = [];
  const serviceWorker = {
    getRegistrations: async () => [
      { update: async () => undefined, waiting: { postMessage: (m: unknown) => messages.push(m) } },
      { update: async () => undefined, waiting: null },
    ],
  };

  const report = await purgeFrontendCaches({
    cacheStorage: { keys: async () => [], delete: async () => true },
    serviceWorker,
  });

  assert.equal(report.workerChecked, true);
  assert.equal(report.workerActivated, true);
  assert.deepEqual(messages, [{ type: 'SKIP_WAITING' }]);
});

test('a failing service worker never throws', async () => {
  const report = await purgeFrontendCaches({
    cacheStorage: { keys: async () => [], delete: async () => true },
    serviceWorker: {
      getRegistrations: async () => {
        throw new Error('blocked');
      },
    },
  });

  assert.equal(report.workerActivated, false);
});

test('the reload marker round-trips through session storage', () => {
  const storage = new MemoryStorage();
  const pending = {
    targetBuildId: 'new-build',
    targetVersion: '1.0.1',
    fromBuildId: 'old-build',
    at: 1_000,
  };

  writePendingReload(pending, storage);
  assert.deepEqual(readPendingReload(storage), pending);

  clearPendingReload(storage);
  assert.equal(readPendingReload(storage), null);
  assert.equal(storage.getItem(RELOAD_MARKER_KEY), null);
});

test('a corrupted reload marker is ignored', () => {
  const storage = new MemoryStorage();
  storage.setItem(RELOAD_MARKER_KEY, '{not json');
  assert.equal(readPendingReload(storage), null);
});

test('resolveReloadOutcome verifies the new build', () => {
  const storage = new MemoryStorage();
  writePendingReload(
    { targetBuildId: 'target', targetVersion: '1.0.1', fromBuildId: 'old', at: 1_000 },
    storage
  );

  const build = normalizeBuildInfo({ version: '1.0.1', buildId: 'target' });
  const outcome = resolveReloadOutcome(build, {
    pending: readPendingReload(storage),
    now: 2_000,
  });

  assert.deepEqual(outcome, { kind: 'verified', build });
});

test('resolveReloadOutcome reports a reload that landed on the old build', () => {
  const build = normalizeBuildInfo({ version: '1.0.0', buildId: 'old' });
  const outcome = resolveReloadOutcome(build, {
    pending: {
      targetBuildId: 'target',
      targetVersion: '1.0.1',
      fromBuildId: 'old',
      at: 1_000,
    },
    now: 2_000,
  });

  assert.equal(outcome?.kind, 'still_stale');
});

test('a marker older than the window is not treated as a result', () => {
  const build = normalizeBuildInfo({ version: '1.0.1', buildId: 'target' });
  const outcome = resolveReloadOutcome(build, {
    pending: {
      targetBuildId: 'target',
      targetVersion: '1.0.1',
      fromBuildId: 'old',
      at: 1_000,
    },
    now: 1_000 + 11 * 60 * 1000,
  });

  assert.equal(outcome, null);
});

test('reloadFromNetwork busts the cache and keeps the route', () => {
  const location = {
    href: 'https://porokhbd.vercel.app/settings?tab=1#top',
    origin: 'https://porokhbd.vercel.app',
    pathname: '/settings',
    search: '?tab=1',
    hash: '#top',
  };

  const target = reloadFromNetwork({ location, now: 42 });

  assert.equal(target, 'https://porokhbd.vercel.app/settings?tab=1&porokh_reload=42#top');
  assert.equal(location.href, target);
});

test('stripReloadMarker removes only the reload parameter', () => {
  const location = {
    pathname: '/settings',
    search: '?tab=1&porokh_reload=42',
    hash: '',
  };
  let replaced = '';

  stripReloadMarker({
    location,
    history: { replaceState: (_s, _t, url) => { replaced = String(url); } },
  });

  assert.equal(replaced, '/settings?tab=1');
});

test('stripReloadMarker leaves unrelated URLs alone', () => {
  let called = false;
  stripReloadMarker({
    location: { pathname: '/settings', search: '?tab=1', hash: '' },
    history: { replaceState: () => { called = true; } },
  });

  assert.equal(called, false);
});
