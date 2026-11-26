import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Check, Loader2 } from 'lucide-react';

import { supabase } from '@/shared/lib/supabase';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isValidUsername, normalizeUsername } from '@/features/auth/utils/username';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits, type AppMessageKey } from '@/shared/i18n/messages';
import { STUDY_GOALS, goalLabel, isStudyGoal } from '@/shared/lib/academic';
import { useStage } from '@/features/stage/hooks/useStage';
import AcademicProfileForm from '@/features/profile/components/AcademicProfileForm';
import {
  normalizeAdmissionTargets,
  validateAcademicProfile,
  type AcademicProfileValues,
} from '@/features/profile/utils/academicProfile';
import { useUsernameAvailability } from '../hooks/useUsernameAvailability';
import {
  ONBOARDING_STEPS,
  buildCompleteOnboardingParams,
  buildOnboardingDraft,
  mapCompleteOnboardingError,
  normalizeFullName,
  type OnboardingDraft,
} from '../utils/onboarding';
import {
  clearOnboardingDraft,
  loadOnboardingDraft,
  saveOnboardingDraft,
} from '../utils/onboardingDraft';

const inputClasses =
  'w-full rounded-2xl border border-input-border bg-input-bg px-4 py-3.5 text-base text-text-primary transition-colors placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-70';

const chipClasses = (selected: boolean) =>
  `rounded-full border px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
    selected
      ? 'border-primary bg-primary text-primary-foreground'
      : 'border-border-color bg-surface text-text-primary hover:bg-surface-elevated'
  }`;

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, updateUserProfile } = useAuth();
  const { language, t } = useLanguage();
  const { refresh: refreshStage } = useStage();
  const userId = user?.id;
  const completedRef = useRef(false);

  const [draft, setDraft] = useState<OnboardingDraft>(() => {
    const saved = userId ? loadOnboardingDraft(userId) : null;

    // Existing profile values prefill the form so a user who is only missing
    // the flag does not retype their name or goal (and their own username
    // counts as available).
    return buildOnboardingDraft(saved, {
      fullName: user?.full_name ?? '',
      username: normalizeUsername(user?.username ?? ''),
      studyGoal: isStudyGoal(user?.study_goal) ? user.study_goal : 'hsc',
      hscBatch: user?.hsc_batch ?? '',
      hscGroup: user?.hsc_group ?? '',
      admissionTargets: user?.admission_targets ?? [],
      otherAdmissionTarget: user?.other_admission_target ?? '',
    });
  });
  const [error, setError] = useState<AppMessageKey | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const step = draft.step;
  const username = normalizeUsername(draft.username);
  const availability = useUsernameAvailability(
    username,
    step === 1,
    user?.username
  );

  useEffect(() => {
    if (!userId || completedRef.current) return;
    saveOnboardingDraft(userId, draft);
  }, [draft, userId]);

  const updateDraft = (patch: Partial<OnboardingDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setError(null);
  };

  const validateStepOne = (): AppMessageKey | null => {
    const fullName = normalizeFullName(draft.fullName);

    if (!fullName) return 'onboarding.nameRequired';
    if (fullName.length < 2 || fullName.length > 80) return 'onboarding.nameInvalid';

    if (!username) return 'onboarding.usernameRequired';
    if (!isValidUsername(username)) return 'onboarding.usernameInvalid';

    if (availability.value !== username || availability.status === 'checking') {
      return 'onboarding.usernameWait';
    }
    if (availability.status === 'taken') return 'onboarding.usernameTaken';
    if (availability.status === 'error') return 'onboarding.usernameCheckFailed';
    if (availability.status !== 'available') return 'onboarding.usernameWait';

    return null;
  };

  const goToStepTwo = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationError = validateStepOne();
    if (validationError) {
      setError(validationError);
      return;
    }

    updateDraft({ step: 2 });
  };

  const complete = async () => {
    if (!userId) {
      setError('onboarding.sessionExpired');
      return;
    }

    setIsSaving(true);
    setError(null);

    const params = buildCompleteOnboardingParams(draft);

    try {
      const { error: rpcError } = await supabase.rpc('complete_onboarding', params);

      if (rpcError) {
        const key = mapCompleteOnboardingError(rpcError);

        if (key === 'onboarding.usernameTaken') {
          updateDraft({ step: 1 });
        }

        setError(key);
        return;
      }

      completedRef.current = true;
      clearOnboardingDraft(userId);
      updateUserProfile(userId, {
        full_name: params.p_full_name,
        username: params.p_username,
        study_goal: params.p_study_goal,
        hsc_batch: params.p_hsc_batch,
        hsc_group: params.p_hsc_group,
        admission_targets: params.p_admission_targets,
        other_admission_target: params.p_other_admission_target,
        onboarding_completed_at: new Date().toISOString(),
      });
      // A student whose exam already ended must meet the goal gate on the very
      // next screen, not after the next cold start.
      void refreshStage();
      navigate('/dashboard/home', { replace: true });
    } catch {
      setError('onboarding.saveFailed');
    } finally {
      setIsSaving(false);
    }
  };

  const academicValues: AcademicProfileValues = {
    hscBatch: draft.hscBatch,
    hscGroup: draft.hscGroup,
    admissionTargets: draft.admissionTargets,
    otherAdmissionTarget: draft.otherAdmissionTarget,
  };

  const updateAcademic = (patch: Partial<AcademicProfileValues>) => {
    setDraft((prev) => ({
      ...prev,
      ...(patch.hscBatch !== undefined ? { hscBatch: patch.hscBatch } : {}),
      ...(patch.hscGroup !== undefined ? { hscGroup: patch.hscGroup } : {}),
      ...(patch.admissionTargets !== undefined
        ? { admissionTargets: normalizeAdmissionTargets(patch.admissionTargets) }
        : {}),
      ...(patch.otherAdmissionTarget !== undefined
        ? { otherAdmissionTarget: patch.otherAdmissionTarget }
        : {}),
    }));
    setError(null);
  };

  const goToStepThree = () => {
    updateDraft({ step: 3 });
  };

  const validateStepThree = (): AppMessageKey | null =>
    validateAcademicProfile(academicValues);

  const finishOnboarding = () => {
    const validationError = validateStepThree();

    if (validationError) {
      setError(validationError);
      return;
    }

    void complete();
  };

  const stepLabel = t('onboarding.stepLabel', {
    current: localizeDigits(step, language),
    total: localizeDigits(ONBOARDING_STEPS.length, language),
  });

  const usernameStatus = (() => {
    if (!username) return null;

    if (availability.status === 'checking') {
      return (
        <span className="flex items-center gap-1.5 text-text-secondary">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          {t('onboarding.usernameChecking')}
        </span>
      );
    }
    if (availability.status === 'available') {
      return (
        <span className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
          <Check className="h-4 w-4" aria-hidden="true" />
          {t('onboarding.usernameAvailable')}
        </span>
      );
    }
    if (availability.status === 'taken') {
      return (
        <span className="flex items-center gap-1.5 font-semibold text-accent">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          {t('onboarding.usernameTakenStatus')}
        </span>
      );
    }
    if (availability.status === 'error') {
      return (
        <span className="flex items-center gap-1.5 font-semibold text-accent">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          {t('onboarding.usernameCheckFailed')}
        </span>
      );
    }

    return null;
  })();

  // Safety net: a completed user never sees the form even when /onboarding is
  // opened directly (deep link, back button, restored Capacitor URL).
  if (user?.onboarding_completed_at) {
    return <Navigate to="/dashboard/home" replace />;
  }

  return (
    <div className="min-h-screen w-full bg-app text-text-primary">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
        <header className="px-4 pb-4 pt-5">
          <div className="flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() =>
                  updateDraft({ step: (step - 1) as OnboardingDraft['step'] })
                }
                disabled={isSaving}
                className="-ml-2 rounded-full p-2 text-text-primary transition-colors hover:bg-surface-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50"
                aria-label={t('onboarding.back')}
              >
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              </button>
            ) : (
              <span className="h-9 w-9" aria-hidden="true" />
            )}

            <span className="font-['Noto_Sans_Bengali'] text-sm font-semibold text-text-secondary">
              {stepLabel}
            </span>
          </div>

          <div className="mt-3 flex gap-2" aria-hidden="true">
            {ONBOARDING_STEPS.map((stepNumber) => (
              <span
                key={stepNumber}
                className={`h-1.5 flex-1 rounded-full ${
                  stepNumber <= step ? 'bg-primary' : 'bg-border-color'
                }`}
              />
            ))}
          </div>
        </header>

        {step === 1 ? (
          <main className="flex-1 px-4 pb-10 pt-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {t('onboarding.step1Title')}
            </h1>
            <p className="mt-1.5 text-[15px] leading-6 text-text-secondary">
              {t('onboarding.step1Subtitle')}
            </p>

            <form onSubmit={goToStepTwo} className="mt-6 space-y-4" noValidate>
              <div className="space-y-2">
                <label
                  htmlFor="onboarding-full-name"
                  className="block text-sm font-semibold"
                >
                  {t('onboarding.fullNameLabel')}
                </label>
                <input
                  id="onboarding-full-name"
                  type="text"
                  required
                  autoComplete="name"
                  maxLength={80}
                  disabled={isSaving}
                  className={inputClasses}
                  placeholder={t('onboarding.fullNamePlaceholder')}
                  value={draft.fullName}
                  onChange={(event) => updateDraft({ fullName: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="onboarding-username"
                  className="block text-sm font-semibold"
                >
                  {t('onboarding.usernameLabel')}
                </label>
                <input
                  id="onboarding-username"
                  type="text"
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="text"
                  minLength={3}
                  maxLength={20}
                  pattern="[a-z0-9_]{3,20}"
                  disabled={isSaving}
                  className={`${inputClasses} lowercase`}
                  placeholder={t('onboarding.usernamePlaceholder')}
                  value={draft.username}
                  onChange={(event) =>
                    updateDraft({ username: event.target.value.toLowerCase() })
                  }
                  aria-describedby="onboarding-username-help onboarding-username-status"
                />
                <p
                  id="onboarding-username-help"
                  className="text-xs leading-5 text-text-secondary"
                >
                  {t('onboarding.usernameHint')}
                </p>
                <p
                  id="onboarding-username-status"
                  role="status"
                  aria-live="polite"
                  className="min-h-5 text-sm"
                >
                  {usernameStatus}
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="flex items-start gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2.5 text-sm text-accent"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <p className="font-medium leading-5">{t(error)}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSaving}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3.5 text-lg font-bold text-primary-foreground transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {t('onboarding.next')}
              </button>
            </form>
          </main>
        ) : step === 2 ? (
          <main className="flex-1 px-4 pb-10 pt-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {t('onboarding.step2Title')}
            </h1>
            <p className="mt-1.5 text-[15px] leading-6 text-text-secondary">
              {t('onboarding.step2Subtitle')}
            </p>

            <div className="mt-7 space-y-7">
              {/* The batch is chosen on the last step, from the admin-owned
                  list. The class chip is gone: it never described a batch. */}
              <section>
                <h2 className="mb-3 text-sm font-semibold text-text-secondary">
                  {t('onboarding.goalLabel')}
                </h2>
                <p className="mb-3 text-xs leading-5 text-text-secondary">
                  {t('onboarding.goalOptionalHint')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {STUDY_GOALS.map((goal) => (
                    <button
                      key={goal}
                      type="button"
                      aria-pressed={draft.studyGoal === goal}
                      onClick={() => updateDraft({ studyGoal: goal })}
                      disabled={isSaving}
                      className={chipClasses(draft.studyGoal === goal)}
                    >
                      {goalLabel(goal, language)}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-pressed={draft.studyGoal === ''}
                    onClick={() => updateDraft({ studyGoal: '' })}
                    disabled={isSaving}
                    className={chipClasses(draft.studyGoal === '')}
                  >
                    {t('onboarding.goalNotDecided')}
                  </button>
                </div>
              </section>
            </div>

            {error && (
              <div
                role="alert"
                aria-live="polite"
                className="mt-6 flex items-start gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2.5 text-sm text-accent"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p className="font-medium leading-5">{t(error)}</p>
              </div>
            )}

            <div className="mt-8 space-y-3">
              <button
                type="button"
                onClick={goToStepThree}
                disabled={isSaving}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3.5 text-lg font-bold text-primary-foreground transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {t('onboarding.next')}
              </button>

              <button
                type="button"
                onClick={() => updateDraft({ studyGoal: '', step: 3 })}
                disabled={isSaving}
                className="w-full rounded-full px-4 py-3 text-base font-semibold text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t('onboarding.skip')}
              </button>
            </div>
          </main>
        ) : (
          <main className="flex-1 px-4 pb-10 pt-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {t('onboarding.step3Title')}
            </h1>
            <p className="mt-1.5 text-[15px] leading-6 text-text-secondary">
              {t('onboarding.step3Subtitle')}
            </p>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                finishOnboarding();
              }}
              className="mt-6"
              noValidate
            >
              <AcademicProfileForm
                idPrefix="onboarding-academic"
                values={academicValues}
                onChange={updateAcademic}
                disabled={isSaving}
              />

              {error && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="mt-6 flex items-start gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2.5 text-sm text-accent"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <p className="font-medium leading-5">{t(error)}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSaving}
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3.5 text-lg font-bold text-primary-foreground transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    <span>{t('onboarding.saving')}</span>
                  </>
                ) : (
                  t('onboarding.finish')
                )}
              </button>
            </form>
          </main>
        )}
      </div>
    </div>
  );
}
