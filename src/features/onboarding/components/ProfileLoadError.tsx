import { AlertCircle } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';

/**
 * Shown when the profile row could not be read. The gate refuses to guess
 * "not onboarded" here; the user can retry instead of being sent to the form.
 */
export function ProfileLoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useLanguage();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-4 text-center">
      <AlertCircle className="mb-4 h-12 w-12 text-accent" aria-hidden="true" />
      <h2 className="text-xl font-bold text-text-primary">
        {t('onboarding.profileLoadFailed')}
      </h2>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 rounded-full bg-primary px-6 py-3 text-base font-bold text-primary-foreground transition-opacity hover:opacity-90 active:scale-[0.98]"
      >
        {t('common.retry')}
      </button>
    </div>
  );
}
