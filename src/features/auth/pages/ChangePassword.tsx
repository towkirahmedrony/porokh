import { Loader2 } from "lucide-react";

import { ChangePasswordCardHeader } from "../components/ChangePasswordCardHeader";
import { ChangePasswordFeedback } from "../components/ChangePasswordFeedback";
import { ChangePasswordForm } from "../components/ChangePasswordForm";
import { ChangePasswordTopBar } from "../components/ChangePasswordTopBar";
import { useChangePasswordController } from "../hooks/useChangePasswordController";
import { useLanguage } from "@/shared/i18n/LanguageProvider";

export default function ChangePassword() {
  const { t } = useLanguage();
  const {
    isRecoveryMode,
    oldPassword,
    newPassword,
    confirmPassword,
    visibleFields,
    isLoading,
    isCheckingSession,
    error,
    successMessage,
    isSuccess,
    errorId,
    canSubmit,
    setOldPassword,
    setNewPassword,
    setConfirmPassword,
    toggleVisibility,
    clearErrorOnInput,
    handleSubmit,
    handleBack,
    handleSuccessNavigate,
  } = useChangePasswordController();

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app p-6">
        <Loader2
          className="h-7 w-7 animate-spin text-primary"
          aria-label={t('common.loading')}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-app transition-colors duration-300">
      <ChangePasswordTopBar
        isRecoveryMode={isRecoveryMode}
        onBack={handleBack}
      />

      <main className="flex flex-1 flex-col justify-center px-4 py-8 sm:px-6">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-card-border bg-card-bg p-6 shadow-sm sm:p-8">
          <ChangePasswordCardHeader isRecoveryMode={isRecoveryMode} />

          <ChangePasswordFeedback
            error={error}
            successMessage={successMessage}
            isRecoveryMode={isRecoveryMode}
            onSuccessNavigate={handleSuccessNavigate}
          />

          <ChangePasswordForm
            isRecoveryMode={isRecoveryMode}
            oldPassword={oldPassword}
            newPassword={newPassword}
            confirmPassword={confirmPassword}
            visibleFields={visibleFields}
            isLoading={isLoading}
            isSuccess={isSuccess}
            canSubmit={canSubmit}
            errorId={errorId}
            hasError={Boolean(error)}
            onOldPasswordChange={(value) => {
              setOldPassword(value);
              clearErrorOnInput();
            }}
            onNewPasswordChange={(value) => {
              setNewPassword(value);
              clearErrorOnInput();
            }}
            onConfirmPasswordChange={(value) => {
              setConfirmPassword(value);
              clearErrorOnInput();
            }}
            onToggleOldVisibility={() => toggleVisibility("old")}
            onToggleNewVisibility={() => toggleVisibility("new")}
            onToggleConfirmVisibility={() => toggleVisibility("confirm")}
            onSubmit={handleSubmit}
          />
        </div>
      </main>
    </div>
  );
}
