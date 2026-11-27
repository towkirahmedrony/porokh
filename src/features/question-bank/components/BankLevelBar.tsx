import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import type { QuestionBankLevel } from '../types/questionBank';

interface BankLevelBarProps {
  level: QuestionBankLevel;
  canSwitchLevel: boolean;
  allTracks: boolean;
  /** Admission total for the current filters, shown beside the chip. */
  admissionTotal: number | null;
  onChangeLevel: (level: QuestionBankLevel) => void;
  onToggleAllTracks: () => void;
}

/**
 * The only control that changes which level the bank is showing.
 *
 * It is absent for a student in admission prep, because for them HSC content is
 * not hidden by a filter, it is not theirs to browse. Rendering a disabled tab
 * there would suggest the content exists behind one tap.
 */
export function BankLevelBar({
  level,
  canSwitchLevel,
  allTracks,
  admissionTotal,
  onChangeLevel,
  onToggleAllTracks,
}: BankLevelBarProps) {
  const { t, language } = useLanguage();

  return (
    <div className="space-y-2">
      {canSwitchLevel && (
        <div
          role="tablist"
          aria-label={t('questionBank.level')}
          className="grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1"
        >
          {(['hsc', 'admission'] as const).map((value) => {
            const active = level === value;
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onChangeLevel(value)}
                className={`h-11 rounded-xl text-[13px] font-bold transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {value === 'hsc' ? t('questionBank.levelHsc') : t('questionBank.levelAdmission')}
              </button>
            );
          })}
        </div>
      )}

      {level === 'admission' && (
        <button
          type="button"
          onClick={onToggleAllTracks}
          aria-pressed={allTracks}
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold transition-colors ${
            allTracks
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border-color bg-surface text-text-secondary'
          }`}
        >
          {t('questionBank.allAdmission')}
          {admissionTotal !== null && (
            <span className="rounded-full bg-app px-1.5 py-0.5 text-[10px] font-bold text-text-secondary">
              {localizeDigits(admissionTotal, language)}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
