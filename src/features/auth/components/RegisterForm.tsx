import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";

import { supabase } from "@/shared/lib/supabase";
import { buildApiUrl } from "@/shared/lib/apiConfig";
import { useLanguage } from "@/shared/i18n/LanguageProvider";
import type { AppMessageKey } from "@/shared/i18n/messages";

interface RegisterFormProps {
  onSuccess: (email: string) => void;
  defaultRefCode?: string | null;
}

type RegisterFormData = {
  email: string;
  password: string;
  confirmPassword: string;
};

/** A message is kept as a key plus its interpolation values so the rendered
 * text always follows the active language. */
type FormMessage = {
  key: AppMessageKey;
  values?: Record<string, string | number>;
};

const INITIAL_FORM_DATA: RegisterFormData = {
  email: "",
  password: "",
  confirmPassword: "",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function getRegisterErrorMessage(error: unknown): FormMessage {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("email_already_registered") || message.includes("already registered")) {
    return { key: "auth.register.blocked" };
  }

  if (message.includes("weak_password") || message.includes("password")) {
    return { key: "auth.register.weakPassword", values: { min: MIN_PASSWORD_LENGTH } };
  }

  if (message.includes("rate_limited") || message.includes("too many")) {
    return { key: "auth.register.rateLimited" };
  }

  if (message.includes("validation_failed") || message.includes("valid email")) {
    return { key: "auth.register.emailInvalid" };
  }

  return { key: "auth.register.failed" };
}

export default function RegisterForm({
  onSuccess,
  defaultRefCode,
}: RegisterFormProps) {
  const { t } = useLanguage();
  const [showPassword, setShowPassword] = useState(false);
  const [customError, setCustomError] = useState<FormMessage | null>(null);
  const [formData, setFormData] = useState<RegisterFormData>(INITIAL_FORM_DATA);

  const registerMutation = useMutation({
    mutationFn: async (userData: RegisterFormData) => {
      const email = normalizeEmail(userData.email);

      const response = await fetch(buildApiUrl("/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: userData.password,
          referred_by_code: defaultRefCode?.trim() || null,
        }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          typeof body?.code === "string"
            ? body.code
            : typeof body?.message === "string"
              ? body.message
              : "registration failed"
        );
      }

      const accessToken = body?.session?.access_token;
      const refreshToken = body?.session?.refresh_token;

      if (typeof accessToken === "string" && typeof refreshToken === "string") {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) throw new Error("registration failed");
      }

      return { email };
    },
    onSuccess: (data) => {
      onSuccess(data.email);
    },
    onError: (error) => {
      setCustomError(getRegisterErrorMessage(error));
    },
  });

  const isPending = registerMutation.isPending;
  const errorId = customError ? "register-form-error" : undefined;

  const updateField = (field: keyof RegisterFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (customError) {
      setCustomError(null);
    }
  };

  const validateForm = (): FormMessage | null => {
    const email = normalizeEmail(formData.email);

    if (!email) {
      return { key: "auth.register.emailRequired" };
    }

    if (!EMAIL_PATTERN.test(email)) {
      return { key: "auth.register.emailInvalid" };
    }

    if (formData.password.length < MIN_PASSWORD_LENGTH) {
      return { key: "auth.register.passwordMin", values: { min: MIN_PASSWORD_LENGTH } };
    }

    if (formData.password !== formData.confirmPassword) {
      return { key: "auth.register.passwordMismatch" };
    }

    return null;
  };

  const handleRegister = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCustomError(null);

    const validationError = validateForm();

    if (validationError) {
      setCustomError(validationError);
      return;
    }

    registerMutation.mutate(formData);
  };

  const inputClasses =
    "w-full rounded-xl border border-input-border bg-input-bg px-4 py-3 text-base text-text-primary transition-colors placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-70";

  return (
    <div className="w-full">
      {customError && (
        <div
          id="register-form-error"
          role="alert"
          aria-live="polite"
          className="mb-3 flex items-start gap-2 rounded-xl border border-border-color bg-surface-elevated p-2.5 text-sm text-text-primary"
        >
          <AlertCircle
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-text-primary"
            aria-hidden="true"
          />
          <p className="font-medium leading-5">{t(customError.key, customError.values)}</p>
        </div>
      )}

      <form onSubmit={handleRegister} className="space-y-3" noValidate>
        <input
          id="register-email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          disabled={isPending}
          className={inputClasses}
          placeholder={t('auth.field.email')}
          value={formData.email}
          onChange={(event) => updateField("email", event.target.value)}
          aria-invalid={Boolean(customError)}
          aria-describedby={errorId}
        />

        <div className="relative">
          <input
            id="register-password"
            type={showPassword ? "text" : "password"}
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            disabled={isPending}
            className={`${inputClasses} pr-12`}
            placeholder={t('auth.register.passwordPlaceholder', { min: MIN_PASSWORD_LENGTH })}
            value={formData.password}
            onChange={(event) => updateField("password", event.target.value)}
            aria-invalid={Boolean(customError)}
            aria-describedby={errorId}
          />

          <button
            type="button"
            disabled={isPending}
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-text-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:cursor-not-allowed"
            aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPasswordAlt')}
            aria-pressed={showPassword}
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Eye className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>

        <input
          id="register-confirm-password"
          type={showPassword ? "text" : "password"}
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          disabled={isPending}
          className={inputClasses}
          placeholder={t('auth.field.confirmPassword')}
          value={formData.confirmPassword}
          onChange={(event) => updateField("confirmPassword", event.target.value)}
          aria-invalid={Boolean(customError)}
          aria-describedby={errorId}
        />

        <button
          type="submit"
          disabled={isPending}
          className="mt-1 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3.5 text-lg font-bold text-primary-foreground transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              <span>{t('auth.signingUp')}</span>
            </>
          ) : (
            t('auth.signUp')
          )}
        </button>
      </form>
    </div>
  );
}
