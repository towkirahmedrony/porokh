import test from 'node:test';
import assert from 'node:assert/strict';

import {
  currentBuild,
  describeBuild,
  isSameBuild,
  normalizeBuildInfo,
} from './buildInfo.ts';

test('normalizeBuildInfo keeps a complete identity untouched', () => {
  const build = normalizeBuildInfo({
    version: '1.2.3',
    buildId: 'abc1234-2026-01-01T00:00:00.000Z',
    channel: 'staging-android',
    builtAt: '2026-01-01T00:00:00.000Z',
  });

  assert.equal(build.version, '1.2.3');
  assert.equal(build.channel, 'staging-android');
  assert.equal(build.buildId, 'abc1234-2026-01-01T00:00:00.000Z');
});

test('normalizeBuildInfo never throws on missing or malformed input', () => {
  for (const input of [undefined, {}, { version: 42, buildId: null }]) {
    const build = normalizeBuildInfo(input as never);
    assert.equal(build.version, '0.0.0');
    assert.equal(build.buildId, 'dev');
    assert.equal(build.channel, 'production-android');
    assert.equal(build.builtAt, '');
  }
});

test('currentBuild falls back to a dev identity outside a build', () => {
  // The Vite define is not present under tsx, which is exactly the fallback path.
  const build = currentBuild();
  assert.equal(build.buildId, 'dev');
  assert.equal(build.version, '0.0.0');
});

test('describeBuild shortens the build id and hides the dev marker', () => {
  assert.equal(
    describeBuild(
      normalizeBuildInfo({ version: '1.0.0', buildId: 'abcdef123456-2026' })
    ),
    '1.0.0 (abcdef1)'
  );
  assert.equal(describeBuild(normalizeBuildInfo({ version: '1.0.0' })), '1.0.0');
});

test('isSameBuild refuses to treat two dev builds as identical', () => {
  const dev = normalizeBuildInfo(undefined);
  const real = normalizeBuildInfo({ version: '1.0.0', buildId: 'abc' });

  assert.equal(isSameBuild(dev, dev), false);
  assert.equal(isSameBuild(real, { ...real }), true);
  assert.equal(isSameBuild(real, { ...real, buildId: 'other' }), false);
});
