import React, { memo } from 'react';
import { Question } from '../types/exam';
import MathDisplay from '@/shared/components/content/MathDisplay';
import { CheckCircle2 } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { pickLang } from '@/shared/i18n/localize';

interface QuestionCardProps {
  question: Question;
  selectedOptionId?: string | null;
  onOptionSelect: (optionId: string) => void;
  /** Optional localized alt text; existing callers keep the English default. */
  imageAlt?: string;
}

const QuestionCard: React.FC<QuestionCardProps> = memo(({
  question,
  selectedOptionId,
  onOptionSelect,
  imageAlt = 'Question',
}) => {
  const { language } = useLanguage();
  
  let questionText = pickLang(language, question.text_bn, question.text_en) || question.text || "";
  let bodyImageUrl: string | null = null;

  if (typeof question.body === 'object' && question.body !== null) {
    questionText = pickLang(language, question.body.text_bn, question.body.text_en) || question.body.text || questionText;
    bodyImageUrl =
      (question.body as { image_url?: string | null }).image_url ?? null;
  } else if (typeof question.body === 'string' && question.body.trim() !== '') {
    questionText = question.body;
  }

  const questionImageUrl =
    question.media_library?.file_url || question.image_url || bodyImageUrl;

  const options = question.options || [];
  const comprehensionImageUrl =
    question.comprehension?.media_library?.file_url ||
    question.comprehension?.image_url;

  return (
    <div className="w-full max-w-3xl mx-auto rounded-2xl shadow-sm border border-card-border bg-card-bg transition-shadow hover:shadow-md duration-300">
      {question.comprehension && (
        <div className="border-b border-border-color bg-surface p-5 md:p-6">
          {comprehensionImageUrl && (
            <img
              src={comprehensionImageUrl}
              alt=""
              className="mb-3 max-h-72 w-full rounded-xl border border-border-color bg-surface-elevated object-contain"
            />
          )}
          <div className="text-[15px] font-['Noto_Sans_Bengali'] leading-relaxed text-text-secondary">
            <MathDisplay content={question.comprehension.body} />
          </div>
        </div>
      )}

      <div className="p-5 md:p-6 lg:p-8">
        <div className="flex items-start gap-4 mb-6 md:mb-8 pr-2">
          <span className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full font-bold text-sm font-mono shadow-sm bg-badge-bg text-badge-text border border-border-color">
            Q
          </span>
          <div className="w-full space-y-3 pt-1">
            <div className="text-[17px] md:text-[18px] font-medium font-['Noto_Sans_Bengali'] leading-relaxed text-text-primary">
              <MathDisplay content={questionText} />
            </div>

            {questionImageUrl && (
              <img
                src={questionImageUrl}
                alt={imageAlt}
                className="max-h-72 w-full rounded-xl border border-border-color bg-surface object-contain"
              />
            )}
          </div>
        </div>

        <div className="space-y-3 md:pl-12 ml-0 md:ml-1">
          {options.map((option) => {
            const isSelected = selectedOptionId === option.id;
            return (
              <button
                key={option.id}
                onClick={() => onOptionSelect(option.id)}
                className={`relative w-full text-left p-4 md:px-5 md:py-4 rounded-xl border-2 transition-all duration-200 flex items-center justify-between hover:bg-surface-elevated active:scale-[0.99] ${isSelected ? 'bg-surface-elevated border-border-color ring-1 ring-focus-ring' : 'bg-transparent border-border-color'}`}
              >
                <div className="flex items-center gap-3 md:gap-4 w-full">
                  <div className={`flex-shrink-0 w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center transition-all duration-200 ${isSelected ? 'bg-primary border-transparent' : 'bg-transparent border-border-color'}`}>
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                    )}
                  </div>
                  <span className={`text-[15px] md:text-[16px] font-['Noto_Sans_Bengali'] leading-snug ${isSelected ? 'text-text-primary font-semibold' : 'text-text-secondary font-normal'}`}>
                    <MathDisplay content={pickLang(language, option.text_bn, option.text_en) || option.text} />
                    {option.image_url && (
                      <img
                        src={option.image_url}
                        alt=""
                        className="mt-2 max-h-32 rounded-lg border border-border-color object-contain"
                      />
                    )}
                  </span>
                </div>
                {isSelected && (
                  <CheckCircle2 size={20} className="animate-in zoom-in flex-shrink-0 ml-3 shadow-sm rounded-full text-text-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});

QuestionCard.displayName = 'QuestionCard';
export default QuestionCard;
