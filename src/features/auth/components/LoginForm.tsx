import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";

import { Capacitor } from "@capacitor/core";
import { supabase } from "@/shared/lib/supabase";
import { buildApiUrl } from "@/shared/lib/apiConfig";
import { useLanguage } from "@/shared/i18n/LanguageProvider";
import type { AppMessageKey } from "@/shared/i18n/messages";
import { getDeviceId } from "@/shared/utils/device";
import { rememberPendingVerificationEmail } from "../utils/pendingVerification";

type LoginFormData = {
  identifier: string;
  password: string;
};

type LocationState = {
  from?: {
    pathname?: string;
    search?: string;
  };
};

const INITIAL_FORM_DATA: LoginFormData = {
  identifier: "",
  password: "",
};

function getLoginErrorMessage(error: unknown): AppMessageKey {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (
    message.includes("invalid login credentials") ||
    message.includes("invalid credentials") ||
    message.includes("unauthorized") ||
    message.includes("401")
  ) {
    return "auth.login.invalidCredentials";
  }

  if (message.includes("email not confirmed")) {
    return "auth.login.emailNotVerified";
  }

  return "auth.login.failed";
}

function getRedirectPath(state: LocationState | null): string {
  const pathname = state?.from?.pathname;

  if (!pathname || pathname.startsWith("/auth")) {
    return "/dashboard";
  }

  return `${pathname}${state?.from?.search ?? ""}`;
}

export default function LoginForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const [showPassword, setShowPassword] = useState(false);
  const [customError, setCustomError] = useState<AppMessageKey | null>(null);
  const [formData, setFormData] = useState<LoginFormData>(INITIAL_FORM_DATA);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginFormData) => {
      let identifier = credentials.identifier.trim().toLowerCase();
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);

      if (!isEmail) {
        const response = await fetch(buildApiUrl('/auth/username-login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: identifier, password: credentials.password }),
        });

        if (!response.ok) {
          throw new Error(response.status === 401 ? 'invalid login credentials' : 'authentication temporarily unavailable');
        }

        const body = await response.json();
        const accessToken = body?.session?.access_token;
        const refreshToken = body?.session?.refresh_token;
        if (body?.success !== true || !accessToken || !refreshToken) {
          throw new Error('invalid login credentials');
        }

        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error || !data?.session) throw new Error('invalid login credentials');
        return data;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: identifier,
        password: credentials.password,
      });

      if (error) {
        throw error;
      }

      if (!data?.session) {
        throw new Error("No session returned from login endpoint.");
      }

      return data;
    },
    onSuccess: async (data) => {
      if (data?.session?.user?.id) {
        try {
          const backendUrl = buildApiUrl('/auth/save-device');
          await fetch(backendUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${data.session.access_token}`,
            },
            body: JSON.stringify({
              device_id: getDeviceId(),
              platform: Capacitor.isNativePlatform() ? 'android' : 'web',
              device_name: /Mobile|Android|iP(hone|od|ad)/.test(navigator.userAgent) ? 'Mobile Device' : 'Desktop/Laptop',
              os_or_browser: navigator.userAgent
            })
          });
        } catch (err) {
          console.error('IP saving process failed:', err);
        }
      }

      const redirectPath = getRedirectPath(location.state as LocationState | null);
      navigate(redirectPath, { replace: true });
    },
    onError: (error) => {
      const key = getLoginErrorMessage(error);
      const identifier = formData.identifier.trim().toLowerCase();

      if (
        key === "auth.login.emailNotVerified" &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)
      ) {
        rememberPendingVerificationEmail(identifier);
      }

      setCustomError(key);
    },
  });

  const isPending = loginMutation.isPending;
  const errorId = customError ? "login-form-error" : undefined;

  const updateField = (field: keyof LoginFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: field === "identifier" ? value.trimStart() : value,
    }));

    if (customError) {
      setCustomError(null);
    }
  };

  const validateForm = (): AppMessageKey | null => {
    const identifier = formData.identifier.trim();
    const password = formData.password;

    if (!identifier) {
      return "auth.login.identifierRequired";
    }

    if (!password) {
      return "auth.login.passwordRequired";
    }

    return null;
  };

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCustomError(null);

    const validationError = validateForm();

    if (validationError) {
      setCustomError(validationError);
      return;
    }

    loginMutation.mutate(formData);
  };

  return (
    <div className="w-full">
      {customError && (
        <div
          id="login-form-error"
          role="alert"
          aria-live="polite"
          className="mb-4 flex items-start gap-2 rounded-lg border border-accent bg-surface-elevated p-3 text-sm text-accent"
        >
          <AlertCircle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-medium">{t(customError)}</p>
            {customError === "auth.login.emailNotVerified" && (
              <Link
                to="/auth/verify-email"
                state={{ email: formData.identifier.trim().toLowerCase() }}
                className="mt-1 inline-block text-sm font-bold underline underline-offset-2"
              >
                {t("auth.login.verifyCta")}
              </Link>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4" noValidate>
        <div className="space-y-1">
          <input
            id="login-identifier"
            type="text"
            required
            autoComplete="username"
            className="w-full rounded-xl border border-input-border bg-input-bg px-4 py-3.5 text-base text-text-primary transition-colors placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-70"
            placeholder={t('auth.field.emailOrUsername')}
            value={formData.identifier}
            onChange={(event) => updateField("identifier", event.target.value)}
            disabled={isPending}
            aria-invalid={Boolean(customError)}
            aria-describedby={errorId}
          />
        </div>

        <div>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-input-border bg-input-bg py-3.5 pl-4 pr-12 text-base text-text-primary transition-colors placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-70"
              placeholder={t('auth.field.password')}
              value={formData.password}
              onChange={(event) => updateField("password", event.target.value)}
              disabled={isPending}
              aria-invalid={Boolean(customError)}
              aria-describedby={errorId}
            />

            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-text-secondary transition-colors hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:cursor-not-allowed"
              aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              aria-pressed={showPassword}
              disabled={isPending}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Eye className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>

          <div className="flex justify-end pb-1 pt-2">
            <Link
              to="/auth/forgot-password"
              className="text-sm font-medium text-primary transition-colors hover:underline"
            >
              {t('auth.forgotPassword')}
            </Link>
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3.5 text-lg font-bold text-primary-foreground transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
              <span>{t('auth.loggingIn')}</span>
            </>
          ) : (
            t('auth.login')
          )}
        </button>
      </form>
    </div>
  );
}
