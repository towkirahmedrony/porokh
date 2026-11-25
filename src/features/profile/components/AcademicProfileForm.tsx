import { Check, ChevronDown } from 'lucide-react';

import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import {
  ADMISSION_TARGET_OPTIONS,
  HSC_BATCH_OPTIONS,
  HSC_GROUP_OPTIONS,
  OTHER_ADMISSION_TARGET_MAX_LENGTH,
  hasOtherAdmissionTarget,
  type AcademicProfileValues,
} from '../utils/academicProfile';

interface AcademicProfileFormProps {
  values: AcademicProfileValues;
  onChange: (patch: Partial<AcademicProfileValues>) => void;
  disabled?: boolean;
  idPrefix: string;
}

const selectClasses =
  'w-full appearance-none rounded-2xl border border-input-border bg-input-bg px-4 py-3.5 pr-10 text-base text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-70';

const labelClasses = 'block text-sm font-semibold text-text-primary';

/**
 * The academic fields shared by registration onboarding and the
 * complete-later page, so both always offer the same options and validation.
 */
export default function AcademicProfileForm({
  values,
  onChange,
  disabled = false,
  idPrefix,
}: AcademicProfileFormProps) {
  const { language, t } = useLanguage();

  const toggleTarget = (target: string) => {
    const selected = values.admissionTargets.includes(target);

    onChange({
      admissionTargets: selected
        ? values.admissionTargets.filter((value) => value !== target)
        : [...values.admissionTargets, target],
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor={`${idPrefix}-batch`} className={labelClasses}>
          {t('academic.hscBatchLabel')}
        </label>
        <div className="relative">
          <select
            id={`${idPrefix}-batch`}
            required
            disabled={disabled}
            className={selectClasses}
            value={values.hscBatch}
            onChange={(event) => onChange({ hscBatch: event.target.value })}
          >
            <option value="" disabled>
              {t('academic.hscBatchPlaceholder')}
            </option>
            {HSC_BATCH_OPTIONS.map((batch) => (
              <option key={batch} value={batch}>
                {localizeDigits(batch, language)}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-text-secondary"
          />
        </div>
        <p className="text-xs leading-5 text-text-secondary">
          {t('academic.hscBatchHint')}
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor={`${idPrefix}-group`} className={labelClasses}>
          {t('academic.hscGroupLabel')}
        </label>
        <div className="relative">
          <select
            id={`${idPrefix}-group`}
            required
            disabled={disabled}
            className={selectClasses}
            value={values.hscGroup}
            onChange={(event) => onChange({ hscGroup: event.target.value })}
          >
            <option value="" disabled>
              {t('academic.hscGroupPlaceholder')}
            </option>
            {HSC_GROUP_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-text-secondary"
          />
        </div>
      </div>

      <fieldset>
        <legend className={labelClasses}>
          {t('academic.admissionTargetsLabel')}
        </legend>
        <p className="mt-1 text-xs leading-5 text-text-secondary">
          {t('academic.admissionTargetsHint')}
        </p>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ADMISSION_TARGET_OPTIONS.map((option) => {
            const selected = values.admissionTargets.includes(option.value);

            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => toggleTarget(option.value)}
                className={`flex min-h-[52px] items-center justify-between gap-2 rounded-2xl border px-3.5 py-3 text-left text-sm font-semibold transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-70 ${
                  selected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border-color bg-surface text-text-primary hover:bg-surface-elevated'
                }`}
              >
                <span className="leading-5">{t(option.labelKey)}</span>
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    selected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border-color'
                  }`}
                >
                  {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>

        {hasOtherAdmissionTarget(values.admissionTargets) && (
          <div className="mt-3 space-y-2">
            <label
              htmlFor={`${idPrefix}-other`}
              className="block text-sm font-semibold text-text-primary"
            >
              {t('academic.otherLabel')}
            </label>
            <input
              id={`${idPrefix}-other`}
              type="text"
              disabled={disabled}
              maxLength={OTHER_ADMISSION_TARGET_MAX_LENGTH}
              className={selectClasses}
              placeholder={t('academic.otherPlaceholder')}
              value={values.otherAdmissionTarget}
              onChange={(event) =>
                onChange({ otherAdmissionTarget: event.target.value })
              }
            />
          </div>
        )}
      </fieldset>
    </div>
  );
}
