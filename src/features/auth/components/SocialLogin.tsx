import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

import { supabase } from "@/shared/lib/supabase";
import { useLanguage } from "@/shared/i18n/LanguageProvider";
import type { AppMessageKey } from "@/shared/i18n/messages";
import {
  OAUTH_ERROR_EVENT,
  buildGoogleOAuthOptions,
  consumePendingOAuthError,
  type OAuthErrorMessageKey,
} from "../utils/oauthCallback";

function getOAuthErrorMessage(error: unknown): AppMessageKey {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("popup") || message.includes("cancel")) {
    return "auth.google.cancelled";
  }

  return "auth.google.failed";
}

export default function SocialLogin() {
  const { t } = useLanguage();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<AppMessageKey | null>(() =>
    consumePendingOAuthError()
  );

  useEffect(() => {
    const handleOAuthError = (event: Event) => {
      const messageKey = (event as CustomEvent<OAuthErrorMessageKey>).detail;
      setErrorMessage(messageKey);
      setIsGoogleLoading(false);
    };

    window.addEventListener(OAUTH_ERROR_EVENT, handleOAuthError);
    return () => window.removeEventListener(OAUTH_ERROR_EVENT, handleOAuthError);
  }, []);

  // Closing the custom tab without finishing sign-in must release the button.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let removed = false;
    const listener = Browser.addListener("browserFinished", () => {
      if (!removed) setIsGoogleLoading(false);
    });

    return () => {
      removed = true;
      void listener.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, []);

  const handleGoogleLogin = async () => {
    if (isGoogleLoading) return;

    setErrorMessage(null);
    setIsGoogleLoading(true);

    try {
      const isNative = Capacitor.isNativePlatform();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: buildGoogleOAuthOptions(window.location.origin, isNative),
      });

      if (error) {
        throw error;
      }

      if (isNative) {
        if (!data.url) {
          throw new Error("Google sign-in URL was not returned");
        }

        await Browser.open({ url: data.url });
      }
    } catch (error) {
      setErrorMessage(getOAuthErrorMessage(error));
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="my-6 flex items-center">
        <div className="flex-1 border-t border-border-color" />
        <span className="px-4 text-sm font-medium text-text-secondary">
          {t('auth.or')}
        </span>
        <div className="flex-1 border-t border-border-color" />
      </div>

      {errorMessage && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-3 flex items-start gap-2 rounded-lg border border-accent bg-surface-elevated p-3 text-sm text-accent"
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <p className="font-medium">{t(errorMessage)}</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <button
          onClick={handleGoogleLogin}
          type="button"
          disabled={isGoogleLoading}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border-color bg-transparent py-3.5 font-medium text-text-primary transition-colors hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isGoogleLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              <span>{t('auth.google.redirecting')}</span>
            </>
          ) : (
            <>
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>{t('auth.google.continue')}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
