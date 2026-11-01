import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

import { supabase } from '@/shared/lib/supabase';
import { LOGIN_PATH } from '../utils/changePasswordUtils';import {
  OAUTH_ERROR_EVENT,
  createCallbackGuard,
  createNativeCallbackHandler,
  setPendingOAuthError,
  type OAuthErrorMessageKey,
} from '../utils/oauthCallback';

// Module scope: a React StrictMode remount must not exchange the same code twice.
const callbackGuard = createCallbackGuard();

/**
 * Handles the OAuth redirect that arrives through the Android custom scheme.
 * The URL is not a page load, so Supabase cannot consume it automatically; the
 * PKCE code is exchanged here and the normal auth listener applies the session.
 */
export function NativeAuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let active = true;

    const handleCallbackUrl = createNativeCallbackHandler({
      exchangeCodeForSession: (code) =>
        supabase.auth.exchangeCodeForSession(code),
      onSuccess: async () => {
        try {
          await Browser.close();
        } catch {
          // The custom tab may already be gone after the deep-link redirect.
        }

        // The onboarding gate sends users who already finished straight home.
        navigate('/onboarding', { replace: true });
      },
      onError: (messageKey) => {
        void Browser.close().catch(() => undefined);
        setPendingOAuthError(messageKey);
        window.dispatchEvent(
          new CustomEvent<OAuthErrorMessageKey>(OAUTH_ERROR_EVENT, {
            detail: messageKey,
          })
        );

        navigate(LOGIN_PATH, { replace: true });
      },
    }, callbackGuard);

    const handleUrl = (url?: string) => {
      if (!active || !url) return;
      void handleCallbackUrl(url);
    };

    // Fires when the app is already running (or retained until this listener
    // attaches when the app was started by the deep link).
    const listener = App.addListener('appUrlOpen', (event) => {
      handleUrl(event.url);
    });

    // Covers a cold start where the redirect launched the app from scratch.
    // A duplicate delivery (listener + launch URL) is ignored by the handler.
    void App.getLaunchUrl()
      .then((result) => handleUrl(result?.url))
      .catch(() => undefined);

    return () => {
      active = false;
      void listener.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [navigate]);

  return null;
}

export default NativeAuthCallback;
