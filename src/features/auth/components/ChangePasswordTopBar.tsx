import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/shared/i18n/LanguageProvider";

type ChangePasswordTopBarProps = {
  isRecoveryMode: boolean;
  onBack: () => void;
};

export function ChangePasswordTopBar({
  isRecoveryMode,
  onBack,
}: ChangePasswordTopBarProps) {
  const { t } = useLanguage();

  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border-color bg-nav-bg/80 px-4 py-4 backdrop-blur-md">
      <button
        type="button"
        onClick={onBack}
        className="rounded-full p-2 text-nav-text transition-colors hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-focus-ring"
        aria-label={t('auth.pw.backAria')}
      >
        <ArrowLeft size={20} aria-hidden="true" />
      </button>

      <h1 className="text-lg font-semibold text-nav-text">
        {isRecoveryMode ? t('auth.pw.resetTitle') : t('auth.pw.changeTitle')}
      </h1>
    </div>
  );
}
