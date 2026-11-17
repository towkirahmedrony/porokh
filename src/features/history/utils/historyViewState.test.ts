import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTabViewState } from './historyViewState';

test('a successful empty result renders the empty state', () => {
  assert.equal(
    resolveTabViewState({ isLoading: false, isError: false, itemCount: 0 }),
    'empty'
  );
});

test('a failed request renders the error state instead of the empty state', () => {
  assert.equal(
    resolveTabViewState({ isLoading: false, isError: true, itemCount: 0 }),
    'error'
  );
});

test('a failed request never reports an empty mistake list', () => {
  // Regression: a 4xx/5xx used to fall through to "কোনো ভুল নেই".
  const state = resolveTabViewState({ isLoading: false, isError: true, itemCount: 0 });
  assert.notEqual(state, 'empty');
});

test('loaded rows stay visible when a background refetch fails', () => {
  assert.equal(
    resolveTabViewState({ isLoading: false, isError: true, itemCount: 12 }),
    'content'
  );
});

test('rows render as content once the request succeeds', () => {
  assert.equal(
    resolveTabViewState({ isLoading: false, isError: false, itemCount: 29 }),
    'content'
  );
});

test('loading wins over the previous error so the spinner is not replaced', () => {
  assert.equal(
    resolveTabViewState({ isLoading: true, isError: true, itemCount: 0 }),
    'loading'
  );
});
