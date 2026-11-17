import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getBackInterceptorCount,
  pushBackInterceptor,
  resetBackInterceptorsForTests,
  runTopBackInterceptor,
} from './backInterceptorRegistry.ts';

test('only the topmost overlay handles a back press', () => {
  resetBackInterceptorsForTests();
  const calls: string[] = [];
  pushBackInterceptor(() => {
    calls.push('page');
    return true;
  });
  pushBackInterceptor(() => {
    calls.push('sheet');
    return true;
  });
  pushBackInterceptor(() => {
    calls.push('dialog');
    return true;
  });

  assert.equal(runTopBackInterceptor(), true);
  assert.deepEqual(calls, ['dialog']);
});

test('unregistering removes the overlay and is idempotent', () => {
  resetBackInterceptorsForTests();
  const handled: string[] = [];
  const removeFirst = pushBackInterceptor(() => {
    handled.push('first');
    return true;
  });
  pushBackInterceptor(() => {
    handled.push('second');
    return true;
  });

  removeFirst();
  removeFirst();

  assert.equal(getBackInterceptorCount(), 1);
  runTopBackInterceptor();
  assert.deepEqual(handled, ['second']);
});

test('a non-dismissible top overlay falls through to the next one', () => {
  resetBackInterceptorsForTests();
  const calls: string[] = [];
  pushBackInterceptor(() => {
    calls.push('dismissible');
    return true;
  });
  pushBackInterceptor(() => {
    calls.push('blocking');
    return false;
  });

  assert.equal(runTopBackInterceptor(), true);
  assert.deepEqual(calls, ['blocking', 'dismissible']);
});

test('a throwing overlay does not swallow the back press', () => {
  resetBackInterceptorsForTests();
  pushBackInterceptor(() => true);
  pushBackInterceptor(() => {
    throw new Error('broken overlay');
  });

  assert.equal(runTopBackInterceptor(), true);
});

test('no overlays means back is unhandled', () => {
  resetBackInterceptorsForTests();
  assert.equal(runTopBackInterceptor(), false);
});
