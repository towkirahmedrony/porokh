import { KeyRound, Lock } from "lucide-react";
import { useLanguage } from "@/shared/i18n/LanguageProvider";

type ChangePasswordCardHeaderProps = {
  isRecoveryMode: boolean;
};

export function ChangePasswordCardHeader({
  isRecoveryMode,
}: ChangePasswordCardHeaderProps) {
  const { t } = useLanguage();

  return (
    <div className="mb-8 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-elevated text-text-primary">
        {isRecoveryMode ? (
          <KeyRound size={32} aria-hidden="true" />
        ) : (
          <Lock size={32} aria-hidden="true" />
        )}
      </div>

      <h2 className="mb-2 text-2xl font-bold text-text-primary">
        {isRecoveryMode ? t('auth.pw.recoveryTitle') : t('auth.pw.updateTitle')}
      </h2>

      <p className="text-sm leading-6 text-text-secondary">
        {isRecoveryMode
          ? t('auth.pw.recoverySubtitle')
          : t('auth.pw.updateSubtitle')}
      </p>
    </div>
  );
}
