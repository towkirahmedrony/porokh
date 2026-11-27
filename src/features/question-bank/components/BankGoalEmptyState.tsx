import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { Button } from '@/shared/components/ui/Button';

interface BankGoalEmptyStateProps {
  onShowAllAdmission: () => void;
}

/**
 * A goal with no questions yet.
 *
 * Medical and engineering hold a handful of questions today, so this is a normal
 * state rather than an error. It offers the one action that actually helps:
 * widen to every admission question instead of staring at an empty list.
 */
export function BankGoalEmptyState({ onShowAllAdmission }: BankGoalEmptyStateProps) {
  const { t } = useLanguage();

  return (
    <div className="rounded-[20px] border border-card-border bg-card-bg px-5 py-8 text-center">
      <p className="text-[13px] font-bold text-text-primary">
        {t('questionBank.goalEmptyTitle')}
      </p>
      <p className="mx-auto mt-1.5 max-w-[34ch] text-[11px] font-medium leading-relaxed text-text-secondary">
        {t('questionBank.goalEmptyBody')}
      </p>
      <Button
        onClick={onShowAllAdmission}
        className="mx-auto mt-4 h-11 rounded-xl px-4 text-xs font-bold"
      >
        {t('questionBank.allAdmission')}
      </Button>
    </div>
  );
}
