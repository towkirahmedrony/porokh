import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_PUSH_TARGET,
  createTapDeduper,
  resolvePushTarget,
} from './pushRouting.ts';

test('in-app paths from the backend are kept, including their query string', () => {
  assert.equal(resolvePushTarget('/history'), '/history');
  assert.equal(resolvePushTarget('/exam/live'), '/exam/live');
  assert.equal(resolvePushTarget('/exam/attempt/abc?resume=1'), '/exam/attempt/abc?resume=1');
  assert.equal(resolvePushTarget('  /dashboard/home  '), '/dashboard/home');
});

test('external, malformed and unsafe targets fall back to the notification list', () => {
  assert.equal(resolvePushTarget('https://example.com/promo'), DEFAULT_PUSH_TARGET);
  assert.equal(resolvePushTarget('//evil.example.com'), DEFAULT_PUSH_TARGET);
  assert.equal(resolvePushTarget('net.porokh.app://auth/callback'), DEFAULT_PUSH_TARGET);
  assert.equal(resolvePushTarget('/dashboard\\evil'), DEFAULT_PUSH_TARGET);
  assert.equal(resolvePushTarget('/notifications\n<script>'), DEFAULT_PUSH_TARGET);
  assert.equal(resolvePushTarget('javascript:alert(1)'), DEFAULT_PUSH_TARGET);
  assert.equal(resolvePushTarget(null), DEFAULT_PUSH_TARGET);
  assert.equal(resolvePushTarget(42), DEFAULT_PUSH_TARGET);
});

test('a route this build no longer serves falls back instead of opening a 404', () => {
  assert.equal(resolvePushTarget('/old-removed-screen'), DEFAULT_PUSH_TARGET);
  // /exam/selection is still a live redirect route, so it stays valid.
  assert.equal(resolvePushTarget('/exam/selection'), '/exam/selection');
});

test('the same notification id is handled once', () => {
  const accept = createTapDeduper(2);

  assert.equal(accept('msg-1'), true);
  assert.equal(accept('msg-1'), false);
  assert.equal(accept('msg-2'), true);
  assert.equal(accept(undefined), true);
  // The window is bounded so a long session cannot grow it forever.
  assert.equal(accept('msg-3'), true);
  assert.equal(accept('msg-1'), true);
});
