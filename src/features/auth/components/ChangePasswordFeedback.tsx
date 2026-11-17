import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle } from "lucide-react";

import { FORGOT_PASSWORD_PATH } from "../utils/changePasswordUtils";
import { useLanguage } from "@/shared/i18n/LanguageProvider";
import type { AppMessageKey } from "@/shared/i18n/messages";

type ChangePasswordFeedbackProps = {
  error: AppMessageKey | null;
  successMessage: AppMessageKey | null;
  isRecoveryMode: boolean;
  onSuccessNavigate: () => void | Promise<void>;
};

export function ChangePasswordFeedback({
  error,
  successMessage,
  isRecoveryMode,
  onSuccessNavigate,
}: ChangePasswordFeedbackProps) {
  const { t } = useLanguage();

  return (
    <>
      {error && (
        <div
          id="change-password-error"
          role="alert"
          aria-live="polite"
          className="mb-6 flex items-start gap-2 rounded-lg border border-border-color bg-surface-elevated p-3 text-sm text-text-primary"
        >
          <AlertCircle
            size={18}
            className="mt-0.5 shrink-0 text-text-primary"
            aria-hidden="true"
          />

          <div>
            <p className="font-medium">{t(error)}</p>

            {isRecoveryMode && (
              <Link
                to={FORGOT_PASSWORD_PATH}
                className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
              >
                {t('auth.pw.sendNewResetLink')}
              </Link>
            )}
          </div>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          aria-live="polite"
          className="mb-6 flex items-start gap-2 rounded-lg border border-border-color bg-surface-elevated p-4 text-sm text-text-primary"
        >
          <CheckCircle
            size={20}
            className="mt-0.5 shrink-0 text-text-primary"
            aria-hidden="true"
          />

          <div>
            <p className="mb-1 font-semibold">
              {isRecoveryMode
                ? t('auth.pw.successResetTitle')
                : t('auth.pw.successChangeTitle')}
            </p>

            <p className="opacity-90">{t(successMessage)}</p>

            <button
              type="button"
              onClick={onSuccessNavigate}
              className="mt-4 rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
            >
              {isRecoveryMode ? t('auth.pw.goToLogin') : t('auth.pw.goToDashboard')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
