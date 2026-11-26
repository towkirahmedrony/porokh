import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, X } from 'lucide-react';

import Button from '@/shared/components/ui/Button';
import { useBackInterceptor } from '@/app/navigation/useBackInterceptor';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { isStudyGoal, type StudyGoal } from '@/shared/lib/academic';
import { GOAL_OPTIONS } from '../constants/goalOptions';
import { useStage } from '../hooks/useStage';
import { GoalCard } from './GoalCard';

interface GoalPickerSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Change the goal at any time after the gate. HSC is only offered while the
 * exam has not ended, because the server rejects it afterwards.
 */
export function GoalPickerSheet({ open, onClose }: GoalPickerSheetProps) {
  const { t } = useLanguage();
  const { goal, stage, setGoal } = useStage();
  const [pending, setPending] = useState<StudyGoal | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hscAvailable = stage === 'studying';

  useBackInterceptor(onClose, open);

  useEffect(() => {
    if (!open) return;

    setPending(isStudyGoal(goal) ? goal : null);
    setError(null);
    setSaving(false);
  }, [open, goal]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, saving, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const save = async () => {
    if (!pending || saving) return;

    setSaving(true);
    setError(null);

    try {
      await setGoal(pending);
      onClose();
    } catch {
      setError(t('profile.goalChangeError'));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label={t('profile.goalClose')}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={saving ? undefined : onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('profile.goalTitle')}
        className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-card-border bg-card-bg p-5 pb-8 shadow-2xl animate-in slide-in-from-bottom duration-300 sm:rounded-3xl sm:pb-5"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          aria-label={t('profile.goalClose')}
          className="absolute right-3 top-3 rounded-full p-2 text-text-secondary hover:bg-surface disabled:opacity-50"
        >
          <X size={18} />
        </button>

        <h2 className="pr-10 text-xl font-bold text-text-primary">{t('profile.goalTitle')}</h2>

        <div className="mt-5 space-y-3">
          {GOAL_OPTIONS.map(({ goal: option, icon, labelKey, hintKey }) => (
            <GoalCard
              key={option}
              icon={icon}
              label={t(labelKey)}
              hint={t(hintKey)}
              selected={pending === option}
              disabled={saving}
              onSelect={() => setPending(option)}
            />
          ))}

          <GoalCard
            icon={BookOpen}
            label={t('goalGate.hsc')}
            hint={hscAvailable ? t('goalGate.hscPrepHint') : t('goalGate.hscGone')}
            selected={pending === 'hsc'}
            disabled={saving || !hscAvailable}
            onSelect={() => setPending('hsc')}
          />
        </div>

        {error ? (
          <p role="alert" className="mt-4 text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}

        <Button
          className="mt-6 w-full py-3 text-base font-semibold"
          onClick={() => void save()}
          disabled={!pending || pending === goal || saving}
        >
          {saving ? t('goalGate.saving') : t('profile.goalSave')}
        </Button>
      </div>
    </div>,
    document.body
  );
}

export default GoalPickerSheet;
