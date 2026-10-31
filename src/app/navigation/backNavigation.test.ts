import test from 'node:test';
import assert from 'node:assert/strict';

import {
  decideBackNavigation,
  isExitPath,
  normalizePathname,
  resolveFallbackPath,
  type BackDecisionInput,
} from './backNavigation.ts';

const decide = (overrides: Partial<BackDecisionInput> = {}) =>
  decideBackNavigation({
    pathname: '/dashboard/home',
    canGoBack: false,
    historyIndex: 0,
    ...overrides,
  });

test('back navigation normalizes query, hash and trailing slashes', () => {
  assert.equal(normalizePathname('/notices/abc?from=push#top'), '/notices/abc');
  assert.equal(normalizePathname('/dashboard/home/'), '/dashboard/home');
  assert.equal(normalizePathname(''), '/');
});

test('any in-app history wins, including at the home root', () => {
  assert.deepEqual(decide({ canGoBack: true }), { type: 'history' });
  assert.deepEqual(decide({ historyIndex: 2 }), { type: 'history' });

  // Even on a nested page with no WebView history, a router index is enough.
  assert.deepEqual(
    decide({ pathname: '/notices/abc', historyIndex: 1 }),
    { type: 'history' }
  );
});

test('the app only exits from root or auth entry screens', () => {
  assert.equal(isExitPath('/dashboard/home'), true);
  assert.equal(isExitPath('/dashboard'), true);
  assert.equal(isExitPath('/auth/login'), true);
  assert.equal(isExitPath('/notices/abc'), false);

  assert.deepEqual(decide({ pathname: '/' }), { type: 'exit' });
  assert.deepEqual(decide({ pathname: '/auth/login' }), { type: 'exit' });
});

test('a deep-linked nested route never exits the app', () => {
  assert.deepEqual(decide({ pathname: '/notices/abc' }), {
    type: 'navigate',
    to: '/notices',
    replace: true,
  });

  assert.deepEqual(decide({ pathname: '/profile/view/u1' }), {
    type: 'navigate',
    to: '/profile',
    replace: true,
  });

  // A battle returns to its own group, not merely the group hub.
  assert.deepEqual(decide({ pathname: '/groups/g1/battles/b1' }), {
    type: 'navigate',
    to: '/groups/g1',
    replace: true,
  });

  assert.deepEqual(decide({ pathname: '/unknown-route' }), {
    type: 'navigate',
    to: '/dashboard/home',
    replace: true,
  });
});

test('model test drill-down unwinds one level at a time', () => {
  assert.equal(
    resolveFallbackPath('/exams/model/preset/subject-1'),
    '/exams/model/preset'
  );
  assert.equal(resolveFallbackPath('/exams/model/preset'), '/exams/model');
  assert.equal(resolveFallbackPath('/admission'), '/dashboard/home');
});

test('admission drill-down falls back inside the admission catalogue', () => {
  assert.equal(
    resolveFallbackPath('/admission/university/university-1'),
    '/admission'
  );
  assert.equal(
    resolveFallbackPath('/admission/university/university-1/unit/unit-1'),
    '/admission/university/university-1'
  );
  assert.equal(resolveFallbackPath('/admission/exam/exam-1'), '/admission');
});

test('account and inbox screens fall back without becoming exits', () => {
  assert.equal(resolveFallbackPath('/settings'), '/profile');
  assert.equal(resolveFallbackPath('/edit-profile'), '/profile');
  assert.equal(resolveFallbackPath('/premium/checkout/plan-1'), '/premium');
});

test('an active exam is never allowed to reach the exit flow', () => {
  assert.deepEqual(
    decide({ pathname: '/exam/attempt/attempt-1', examActive: true }),
    { type: 'navigate', to: '/exams/model', replace: true }
  );

  assert.deepEqual(
    decide({ pathname: '/admission/exam/exam-1', examActive: true }),
    { type: 'navigate', to: '/admission', replace: true }
  );

  // History still takes priority while an exam is active.
  assert.deepEqual(
    decide({ pathname: '/exam/attempt/attempt-1', examActive: true, canGoBack: true }),
    { type: 'history' }
  );
});

test('rapid repeated decisions are deterministic and never exit from nested pages', () => {
  const input: BackDecisionInput = {
    pathname: '/dashboard/streak',
    canGoBack: false,
    historyIndex: 0,
  };

  const first = decideBackNavigation(input);
  const second = decideBackNavigation(input);

  assert.deepEqual(first, { type: 'navigate', to: '/dashboard/home', replace: true });
  assert.deepEqual(second, first);
});
