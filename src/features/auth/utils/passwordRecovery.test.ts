import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PASSWORD_RECOVERY_PUBLIC_MESSAGE_KEY,
  PASSWORD_RECOVERY_REDIRECT_PATH,
  requestPasswordRecovery,
} from './passwordRecovery';
import { APP_LANGUAGES, APP_MESSAGES } from '@/shared/i18n/messages';

test('recovery calls Supabase Auth directly and uses the public recovery route', async () => {
  const calls: Array<{ email: string; redirectTo: string }> = [];
  const auth = {
    resetPasswordForEmail: async (email: string, options: { redirectTo: string }) => {
      calls.push({ email, redirectTo: options.redirectTo });
      return { error: null };
    },
  };

  await requestPasswordRecovery('  User@Example.COM ', auth, 'https://porokhbd.vercel.app');

  assert.deepEqual(calls, [{
    email: 'user@example.com',
    redirectTo: `https://porokhbd.vercel.app${PASSWORD_RECOVERY_REDIRECT_PATH}`,
  }]);
  // The public copy must never reveal whether an account exists, in any
  // language: it is shown identically for known and unknown addresses.
  for (const language of APP_LANGUAGES) {
    const message = APP_MESSAGES[language][PASSWORD_RECOVERY_PUBLIC_MESSAGE_KEY];
    assert.equal(message.includes('registered'), false);
    assert.equal(message.includes('not found'), false);
    assert.equal(message.length > 0, true);
  }
});

test('recovery does not reject or expose Auth errors that could identify an account', async () => {
  const auth = {
    resetPasswordForEmail: async () => ({ error: { message: 'email address is registered' } }),
  };

  await assert.doesNotReject(() => requestPasswordRecovery('user@example.com', auth, 'https://example.com'));
});

test('recovery handles a rejected Auth request without exposing its details', async () => {
  const auth = {
    resetPasswordForEmail: async () => {
      throw new Error('private provider diagnostic with account details');
    },
  };

  await assert.doesNotReject(() => requestPasswordRecovery('user@example.com', auth, 'https://example.com'));
});
