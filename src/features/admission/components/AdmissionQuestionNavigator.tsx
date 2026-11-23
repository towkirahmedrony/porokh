import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import { pickLang } from '@/shared/i18n/localize';
import type { AdmissionQuestionSection } from '../lib/admissionExamSections';

interface AdmissionQuestionNavigatorProps {
  sections: AdmissionQuestionSection[];
  /** Attempt-order index of the question currently in view. */
  activeIndex: number;
  answers: Record<string, string>;
  onSelect: (index: number) => void;
}

/**
 * Compact, collapsible jump list. It stays a navigation aid, not a competing
 * panel: one summary row by default, grouped question numbers when expanded.
 */
export const AdmissionQuestionNavigator: React.FC<
  AdmissionQuestionNavigatorProps
> = ({ sections, activeIndex, answers, onSelect }) => {
  const { t, language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const total = sections.reduce((count, section) => count + section.entries.length, 0);
  const answered = sections.reduce(
    (count, section) =>
      count + section.entries.filter((entry) => Boolean(answers[entry.question.id])).length,
    0
  );

  return (
    <section
      aria-label={t('admission.questionNavigator')}
      className="rounded-xl border border-card-border bg-card-bg"
    >
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex min-h-[2.75rem] w-full items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate font-bengali text-[13px] font-semibold text-text-primary">
            {t('admission.questionNavigator')}
          </span>
          <span className="shrink-0 font-bengali text-[11px] font-medium text-text-secondary">
            {localizeDigits(answered, language)} / {localizeDigits(total, language)}
          </span>
        </span>

        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`shrink-0 text-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="max-h-[19rem] space-y-3 overflow-y-auto border-t border-border-color px-4 py-3">
          {sections.map((section, sectionIndex) => {
            const subjectName =
              pickLang(language, section.nameBn, section.nameEn) ||
              (section.subjectId
                ? t('admission.subjectFallback', {
                    number: localizeDigits(sectionIndex + 1, language),
                  })
                : t('admission.otherSubject'));

            return (
              <div key={section.key}>
                <p className="mb-1.5 font-bengali text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                  {subjectName}
                </p>

                <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-10">
                  {section.entries.map(({ question, index }) => {
                    const isActive = index === activeIndex;
                    const isAnswered = Boolean(answers[question.id]);

                    return (
                      <button
                        key={question.id}
                        type="button"
                        aria-current={isActive ? 'true' : undefined}
                        aria-label={`${t('admission.questionNumber', {
                          number: localizeDigits(index + 1, language),
                        })}${isAnswered ? ` — ${t('admission.answered')}` : ''}`}
                        onClick={() => {
                          onSelect(index);
                          setIsOpen(false);
                        }}
                        className={`relative flex h-9 w-full items-center justify-center rounded-md border font-bengali text-[11px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                          isActive
                            ? 'border-primary bg-primary text-primary-foreground'
                            : isAnswered
                              ? 'border-primary/40 bg-badge-bg text-badge-text'
                              : 'border-border-color bg-surface text-text-secondary hover:bg-surface-elevated'
                        }`}
                      >
                        {localizeDigits(index + 1, language)}
                        {isAnswered && !isActive && (
                          <span
                            aria-hidden="true"
                            className="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
