import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGoogleOAuthOptions,
  buildOAuthRedirectUrl,
  consumePendingOAuthError,
  createCallbackGuard,
  createNativeCallbackHandler,
  parseOAuthCallbackUrl,
  setPendingOAuthError,
} from './oauthCallback';

test('web sign-in redirects to the site callback route', () => {
  assert.equal(
    buildOAuthRedirectUrl('https://porokhbd.vercel.app', false),
    'https://porokhbd.vercel.app/auth/callback'
  );
  assert.equal(
    buildOAuthRedirectUrl('https://porokhbd.vercel.app/', false),
    'https://porokhbd.vercel.app/auth/callback'
  );
});

test('native sign-in redirects to the registered custom scheme', () => {
  assert.equal(
    buildOAuthRedirectUrl('https://localhost', true),
    'net.porokh.app://auth/callback'
  );
  assert.equal(
    buildOAuthRedirectUrl('https://porokhbd.vercel.app', true),
    'net.porokh.app://auth/callback'
  );
});

test('native sign-in skips the WebView redirect and uses the custom scheme', () => {
  assert.deepEqual(buildGoogleOAuthOptions('https://localhost', true), {
    redirectTo: 'net.porokh.app://auth/callback',
    skipBrowserRedirect: true,
    queryParams: { prompt: 'select_account' },
  });
});

test('web sign-in keeps the site redirect and lets Supabase navigate', () => {
  assert.deepEqual(
    buildGoogleOAuthOptions('https://porokhbd.vercel.app', false),
    {
      redirectTo: 'https://porokhbd.vercel.app/auth/callback',
      skipBrowserRedirect: false,
      queryParams: { prompt: 'select_account' },
    }
  );
});

test('a PKCE authorization code callback is recognized', () => {
  assert.deepEqual(
    parseOAuthCallbackUrl('net.porokh.app://auth/callback?code=abc123'),
    { kind: 'code', code: 'abc123' }
  );
});

test('a denied permission is reported as a cancellation', () => {
  assert.deepEqual(
    parseOAuthCallbackUrl(
      'net.porokh.app://auth/callback?error=access_denied&error_description=User+denied'
    ),
    { kind: 'error', messageKey: 'auth.google.cancelled' }
  );
});

test('other provider errors are reported as a failure', () => {
  assert.deepEqual(
    parseOAuthCallbackUrl(
      'net.porokh.app://auth/callback?error=server_error&error_description=Something+failed'
    ),
    { kind: 'error', messageKey: 'auth.google.failed' }
  );
});

test('callbacks for another scheme, host or path are ignored', () => {
  const rejected = [
    'https://porokhbd.vercel.app/auth/callback?code=abc123',
    'evil://auth/callback?code=abc123',
    'net.porokh.app://evil/callback?code=abc123',
    'net.porokh.app://auth/other?code=abc123',
    'net.porokh.app://auth/callback/extra?code=abc123',
  ];

  for (const url of rejected) {
    assert.deepEqual(parseOAuthCallbackUrl(url), { kind: 'ignored' }, url);
  }
});

test('a callback without a code or error is ignored', () => {
  assert.deepEqual(
    parseOAuthCallbackUrl('net.porokh.app://auth/callback'),
    { kind: 'ignored' }
  );
  assert.deepEqual(
    parseOAuthCallbackUrl('net.porokh.app://auth/callback?code='),
    { kind: 'ignored' }
  );
  // Implicit-flow tokens must never be treated as a PKCE code.
  assert.deepEqual(
    parseOAuthCallbackUrl(
      'net.porokh.app://auth/callback#access_token=abc&refresh_token=def'
    ),
    { kind: 'ignored' }
  );
});

test('a callback guard ignores an in-flight or already handled key', () => {
  const guard = createCallbackGuard();

  assert.equal(guard.begin('abc123'), true);
  assert.equal(guard.begin('abc123'), false);

  guard.finish('abc123');
  assert.equal(guard.begin('abc123'), false);
  assert.equal(guard.begin('xyz789'), true);
});

test('a valid native callback exchanges the code exactly once', async () => {
  const exchanged: string[] = [];
  let successes = 0;
  const errors: string[] = [];

  const handler = createNativeCallbackHandler({
    exchangeCodeForSession: async (code) => {
      exchanged.push(code);
      return { error: null };
    },
    onSuccess: () => {
      successes += 1;
    },
    onError: (messageKey) => {
      errors.push(messageKey);
    },
  });

  const url = 'net.porokh.app://auth/callback?code=abc123';
  await handler(url);
  await handler(url);

  assert.deepEqual(exchanged, ['abc123']);
  assert.equal(successes, 1);
  assert.deepEqual(errors, []);
});

test('concurrent duplicate callbacks only exchange once', async () => {
  let exchanges = 0;
  const handler = createNativeCallbackHandler({
    exchangeCodeForSession: async () => {
      exchanges += 1;
      return { error: null };
    },
    onSuccess: () => undefined,
    onError: () => undefined,
  });

  const url = 'net.porokh.app://auth/callback?code=same-code';
  await Promise.all([handler(url), handler(url), handler(url)]);

  assert.equal(exchanges, 1);
});

test('a cancelled callback never creates a session', async () => {
  const exchanged: string[] = [];
  const errors: string[] = [];

  const handler = createNativeCallbackHandler({
    exchangeCodeForSession: async (code) => {
      exchanged.push(code);
      return { error: null };
    },
    onSuccess: () => undefined,
    onError: (messageKey) => {
      errors.push(messageKey);
    },
  });

  await handler(
    'net.porokh.app://auth/callback?error=access_denied&error_description=User+denied'
  );

  assert.deepEqual(exchanged, []);
  assert.deepEqual(errors, ['auth.google.cancelled']);
});

test('a failed code exchange reports an error and does not retry it', async () => {
  let exchanges = 0;
  const errors: string[] = [];

  const handler = createNativeCallbackHandler({
    exchangeCodeForSession: async () => {
      exchanges += 1;
      return { error: new Error('invalid grant') };
    },
    onSuccess: () => undefined,
    onError: (messageKey) => {
      errors.push(messageKey);
    },
  });

  const url = 'net.porokh.app://auth/callback?code=expired-code';
  await handler(url);
  await handler(url);

  assert.equal(exchanges, 1);
  assert.deepEqual(errors, ['auth.google.failed']);
});

test('an invalid callback is ignored without touching authentication', async () => {
  let exchanges = 0;
  let successes = 0;
  const errors: string[] = [];

  const handler = createNativeCallbackHandler({
    exchangeCodeForSession: async () => {
      exchanges += 1;
      return { error: null };
    },
    onSuccess: () => {
      successes += 1;
    },
    onError: (messageKey) => {
      errors.push(messageKey);
    },
  });

  await handler('https://porokhbd.vercel.app/auth/callback?code=abc123');

  assert.equal(exchanges, 0);
  assert.equal(successes, 0);
  assert.deepEqual(errors, []);
});

test('a pending OAuth error survives until the login screen consumes it', () => {
  setPendingOAuthError('auth.google.failed');
  assert.equal(consumePendingOAuthError(), 'auth.google.failed');
  assert.equal(consumePendingOAuthError(), null);
});
