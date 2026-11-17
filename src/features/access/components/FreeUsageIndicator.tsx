import { Crown, Sparkles } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { useAccess } from '../hooks/useAccess';

interface FreeUsageIndicatorProps {
  className?: string;
  /** Compact variant for dense list headers. */
  compact?: boolean;
}

/**
 * Shows remaining free exams for metered accounts and a Premium badge for
 * premium users. Unlimited exam access is derived from the authoritative
 * access payload, not from the tier label alone.
 */
export const FreeUsageIndicator = ({ className = '', compact = false }: FreeUsageIndicatorProps) => {
  const { t, language } = useLanguage();
  const { isAuthenticated, isLoading, isPremium, examsLeft, unlimitedExam } = useAccess();

  if (!isAuthenticated || isLoading) return null;

  if (isPremium) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-primary ${
          compact ? 'text-[11px]' : 'text-xs'
        } font-semibold ${className}`}
      >
        <Crown size={compact ? 12 : 14} className="fill-current" />
        {t('premium.premium_badge')}
      </div>
    );
  }

  if (unlimitedExam) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border border-border-color bg-surface px-2.5 py-1 text-text-secondary ${
          compact ? 'text-[11px]' : 'text-xs'
        } font-medium ${className}`}
      >
        <Sparkles size={compact ? 12 : 14} />
        {t('premium.unlimited')}
      </div>
    );
  }

  if (examsLeft === null) return null;

  const label =
    examsLeft === 1
      ? t('premium.free_left_one')
      : t('premium.free_left', { n: examsLeft });

  const isExhausted = examsLeft === 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
        compact ? 'text-[11px]' : 'text-xs'
      } font-medium ${
        isExhausted
          ? 'border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400'
          : 'border border-border-color bg-surface text-text-secondary'
      } ${className}`}
    >
      <Sparkles size={compact ? 12 : 14} />
      <span lang={language}>{label}</span>
    </div>
  );
};

export default FreeUsageIndicator;
