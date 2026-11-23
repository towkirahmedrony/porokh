import React, { memo } from 'react';
import { Check } from 'lucide-react';
import MathDisplay from '@/shared/components/content/MathDisplay';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import { pickLang } from '@/shared/i18n/localize';
import type { Question } from '@/features/exam/types/exam';
import { admissionQuestionAnchorId } from '../lib/admissionExamSections';

interface AdmissionExamQuestionCardProps {
  question: Question;
  /** 1-based position in the server-frozen attempt order. */
  number: number;
  selectedOptionId?: string | null;
  onOptionSelect: (questionId: string, optionId: string) => void;
  imageAlt?: string;
}

/**
 * One question in the single-page admission attempt. Purely presentational:
 * the page owns the answer state and its persistence.
 */
const AdmissionExamQuestionCard: React.FC<AdmissionExamQuestionCardProps> = memo(
  ({ question, number, selectedOptionId, onOptionSelect, imageAlt = 'Question' }) => {
    const { language, t } = useLanguage();

    let questionText =
      pickLang(language, question.text_bn, question.text_en) || question.text || '';
    let bodyImageUrl: string | null = null;

    if (typeof question.body === 'object' && question.body !== null) {
      questionText =
        pickLang(language, question.body.text_bn, question.body.text_en) ||
        question.body.text ||
        questionText;
      bodyImageUrl =
        (question.body as { image_url?: string | null }).image_url ?? null;
    } else if (typeof question.body === 'string' && question.body.trim() !== '') {
      questionText = question.body;
    }

    const questionImageUrl =
      question.media_library?.file_url || question.image_url || bodyImageUrl;
    const comprehensionImageUrl =
      question.comprehension?.media_library?.file_url ||
      question.comprehension?.image_url;
    const options = question.options || [];
    const questionLabel = t('admission.questionNumber', {
      number: localizeDigits(number, language),
    });

    return (
      <article
        id={admissionQuestionAnchorId(question.id)}
        aria-label={questionLabel}
        className="scroll-mt-[7.5rem] rounded-xl border border-card-border bg-card-bg"
      >
        {question.comprehension && (
          <div className="border-b border-border-color bg-surface px-4 py-3.5 sm:px-5">
            {comprehensionImageUrl && (
              <img
                src={comprehensionImageUrl}
                alt=""
                loading="lazy"
                className="mb-3 max-h-64 w-full rounded-lg border border-border-color bg-surface-elevated object-contain"
              />
            )}
            <div className="font-bengali text-[14px] leading-relaxed text-text-secondary">
              <MathDisplay content={question.comprehension.body} />
            </div>
          </div>
        )}

        <div className="px-4 py-4 sm:px-5 sm:py-5">
          <div className="mb-3 flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-7 min-w-[2rem] shrink-0 items-center justify-center rounded-md border border-border-color bg-badge-bg px-1.5 font-bengali text-[12px] font-bold text-badge-text">
              {localizeDigits(String(number).padStart(2, '0'), language)}
            </span>

            <div className="min-w-0 flex-1 space-y-3">
              <div className="font-bengali text-[16px] font-medium leading-[1.75] text-text-primary sm:text-[17px]">
                <MathDisplay content={questionText} />
              </div>

              {questionImageUrl && (
                <img
                  src={questionImageUrl}
                  alt={imageAlt}
                  loading="lazy"
                  className="max-h-72 w-full rounded-lg border border-border-color bg-surface object-contain"
                />
              )}
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="sr-only">{questionLabel}</legend>

            {options.map((option) => {
              const isSelected = selectedOptionId === option.id;
              const optionText =
                pickLang(language, option.text_bn, option.text_en) || option.text;

              return (
                <label
                  key={option.id}
                  className={`flex min-h-[2.75rem] cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors focus-within:ring-2 focus-within:ring-focus-ring ${
                    isSelected
                      ? 'border-primary bg-badge-bg text-text-primary'
                      : 'border-border-color bg-surface text-text-secondary hover:bg-surface-elevated'
                  }`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    name={`question-${question.id}`}
                    value={option.id}
                    checked={isSelected}
                    onChange={() => onOptionSelect(question.id, option.id)}
                  />

                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex shrink-0 items-center justify-center rounded-full border ${
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border-color bg-transparent'
                    }`}
                    style={{ width: '1.125rem', height: '1.125rem' }}
                  >
                    {isSelected && <Check size={12} strokeWidth={3} />}
                  </span>

                  <div
                    className={`min-w-0 flex-1 font-bengali text-[15px] leading-relaxed ${
                      isSelected ? 'font-semibold text-text-primary' : 'font-normal'
                    }`}
                  >
                    <MathDisplay content={optionText} />
                    {option.image_url && (
                      <img
                        src={option.image_url}
                        alt=""
                        loading="lazy"
                        className="mt-2 max-h-32 rounded-md border border-border-color object-contain"
                      />
                    )}
                  </div>
                </label>
              );
            })}
          </fieldset>
        </div>
      </article>
    );
  }
);

AdmissionExamQuestionCard.displayName = 'AdmissionExamQuestionCard';
export default AdmissionExamQuestionCard;
