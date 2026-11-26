import { useEffect, useState, type ReactNode } from 'react';
import { BookOpen } from 'lucide-react';

import { useLanguage } from '@/shared/i18n/LanguageProvider';
import {
  formatBatchLabel,
  goalLabel,
  isAdmissionGoal,
  type AdmissionGoal,
  type StudyGoal,
} from '@/shared/lib/academic';
import { pushBackInterceptor } from '@/app/navigation/backInterceptorRegistry';
import { GOAL_OPTIONS } from '../constants/goalOptions';
import { useStage } from '../hooks/useStage';
import { GoalCard } from './GoalCard';

/**
 * The one mandatory decision after the HSC exam.
 *
 * Rendered by PermissionGuard instead of the app, so Home never mounts first,
 * the hardware Back button cannot dismiss it, and a deep link only lands on the
 * gate. A student whose goal is already stored gets a one-tap confirmation
 * instead of the full choice.
 */
export function GoalGate() {
  const { t, language } = useLanguage();
  const { goal, batchYear, setGoal } = useStage();

  const storedGoal = isAdmissionGoal(goal) ? goal : null;
  const [mode, setMode] = useState<'confirm' | 'choose'>(storedGoal ? 'confirm' : 'choose');
  const [pending, setPending] = useState<AdmissionGoal | null>(storedGoal);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Back must not leave a mandatory screen, and must not close the app.
  useEffect(() => pushBackInterceptor(() => true), []);

  const batchLabel = formatBatchLabel(batchYear, language);
  const storedOption = GOAL_OPTIONS.find((option) => option.goal === storedGoal);

  const commit = async (next: StudyGoal) => {
    if (saving) return;

    setSaving(true);
    setError(null);

    try {
      await setGoal(next);
    } catch {
      setError(t('goalGate.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const shell = (children: ReactNode) => (
    <div className="flex min-h-screen flex-col bg-app px-5 pb-8 pt-12">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        {batchLabel ? (
          <span className="self-start rounded-lg bg-secondary px-3 py-1 text-xs font-semibold text-text-secondary">
            {batchLabel}
          </span>
        ) : null}
        {children}
      </div>
    </div>
  );

  if (mode === 'confirm' && storedOption && storedGoal) {
    const Icon = storedOption.icon;

    return shell(
      <>
        <h1 className="mt-4 text-[26px] font-bold leading-tight text-text-primary">
          {t('goalGate.confirmTitle', { goal: goalLabel(storedGoal, language) })}
        </h1>

        <div className="mt-6">
          <GoalCard
            icon={Icon}
            label={t(storedOption.labelKey)}
            hint={t(storedOption.hintKey)}
            selected
          />
        </div>

        {error ? (
          <p role="alert" className="mt-4 text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}

        <div className="mt-auto space-y-3 pt-8">
          <button
            type="button"
            onClick={() => void commit(storedGoal)}
            disabled={saving}
            className="min-h-12 w-full rounded-xl bg-primary px-4 py-3 text-[16px] font-bold text-primary-foreground transition-opacity active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? t('goalGate.saving') : t('goalGate.confirmYes')}
          </button>
          <button
            type="button"
            onClick={() => setMode('choose')}
            disabled={saving}
            className="min-h-12 w-full rounded-xl px-4 py-3 text-[15px] font-semibold text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('goalGate.confirmChange')}
          </button>
        </div>
      </>
    );
  }

  return shell(
    <>
      <h1 className="mt-4 text-[28px] font-bold leading-tight text-text-primary">
        {t('goalGate.title')}
      </h1>
      <p className="mt-2 text-[15px] leading-6 text-text-secondary">{t('goalGate.subtitle')}</p>

      <div className="mt-6 space-y-3" role="group" aria-label={t('goalGate.title')}>
        {GOAL_OPTIONS.map(({ goal: option, icon, labelKey, hintKey }) => (
          <GoalCard
            key={option}
            icon={icon}
            label={t(labelKey)}
            hint={t(hintKey)}
            selected={pending === option}
            onSelect={() => setPending(option)}
          />
        ))}

        {/* Kept visible so the student sees why the old track is gone,
            rather than wondering where it went. Not selectable. */}
        <GoalCard
          icon={BookOpen}
          label={t('goalGate.hsc')}
          hint={t('goalGate.hscGone')}
          selected={false}
          disabled
        />
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-auto pt-8">
        <button
          type="button"
          onClick={() => pending && void commit(pending)}
          disabled={!pending || saving}
          className="min-h-12 w-full rounded-xl bg-primary px-4 py-3 text-[16px] font-bold text-primary-foreground transition-opacity active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? t('goalGate.saving') : t('goalGate.continue')}
        </button>
        <p className="mt-3 text-center text-xs leading-5 text-text-secondary">
          {t('goalGate.changeLater')}
        </p>
      </div>
    </>
  );
}
