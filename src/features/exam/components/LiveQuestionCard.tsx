import React, { memo } from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { CheckCircle2, Flag, XCircle } from 'lucide-react';
import { Question, ExamQuestion } from '../types/exam';
import MathDisplay from '@/shared/components/content/MathDisplay';
import { pickLang } from '@/shared/i18n/localize';

interface LiveQuestionCardProps {
  question: Question | ExamQuestion;
  index: number;
  selectedOptionId?: string;
  onSelectOption: (questionId: string, optionId: string) => void;
  onReport: (questionId: string) => void;
  revealed?: boolean;
  correctOptionId?: string | null;
}

const LiveQuestionCard: React.FC<LiveQuestionCardProps> = memo(({
  question,
  index,
  selectedOptionId,
  onSelectOption,
  onReport,
  revealed = false,
  correctOptionId = null,
}) => {
  const { language } = useLanguage();
  const isLocked = !!selectedOptionId;
  
  let questionText = pickLang(language, question.text_bn, question.text_en) || question.text || "";
  if (typeof question.body === 'object' && question.body !== null) {
    questionText = pickLang(language, question.body.text_bn, question.body.text_en) || question.body.text || questionText;
  } else if (typeof question.body === 'string' && question.body.trim() !== '') {
    questionText = question.body;
  }
  
  const qImageUrl = question.media_library?.file_url || question.image_url;
  const compImageUrl = question.comprehension?.media_library?.file_url || question.comprehension?.image_url;

  const { t } = useLanguage();
  return (
    <div className="rounded-2xl border border-card-border bg-card-bg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 relative group">
      
      {/* 1. Stem (Comprehension) */}
      {question.comprehension && (
        <div className="border-b border-border-color bg-surface p-5 md:p-6 relative">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
          <h4 className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2 text-text-primary opacity-80">
            {t('exam.stimulus')}
          </h4>
          
          {compImageUrl && (
            <img 
              src={compImageUrl} 
              alt={t('exam.stimulus')}
              className="w-full max-h-72 object-contain rounded-xl mb-4 border border-border-color bg-surface-elevated"
            />
          )}
          
          <div className="text-[15px] leading-relaxed font-['Noto_Sans_Bengali'] text-text-secondary">
            <MathDisplay content={question.comprehension.body} />
          </div>
        </div>
      )}

      <div className="p-5 md:p-6 lg:p-8 relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onReport(question.id);
          }}
          className="absolute top-4 right-4 p-2 rounded-lg border border-border-color bg-card-bg text-text-secondary transition-opacity z-10 shadow-sm flex items-center gap-1.5 opacity-60 hover:opacity-100 md:opacity-0 md:group-hover:opacity-100"
          title={t('exam.report')}
        >
          <Flag size={14} strokeWidth={2.5} />
          <span className="text-[10px] font-medium hidden sm:inline-block">{t('exam.reportShort')}</span>
        </button>

        {/* 2. Question Area */}
        <div className="flex gap-4 mb-6 md:mb-8 pr-8">
          <span className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-sm font-bold font-mono shadow-sm bg-badge-bg text-badge-text border border-border-color">
            {index + 1}
          </span>
          <div className="space-y-4 w-full pt-1">
            <div className="text-[17px] md:text-[18px] font-medium font-['Noto_Sans_Bengali'] leading-relaxed text-text-primary">
              <MathDisplay content={questionText} />
            </div>
            
            {qImageUrl && (
              <div className="relative mt-3">
                <img 
                  src={qImageUrl} 
                  alt={t('exam.questionImageAlt')}
                  className="w-full max-h-72 object-contain rounded-xl border border-border-color bg-surface"
                />
              </div>
            )}
          </div>
        </div>

        {/* 3. Options Area */}
        <div className="grid grid-cols-1 gap-3 pl-0 md:pl-12 lg:pl-12 ml-0 md:ml-1">
          {question.options.map((option) => {
            const isSelected = selectedOptionId === option.id;
            const isCorrectOption = revealed && correctOptionId === option.id;
            const isWrongSelection = revealed && isSelected && !isCorrectOption;

            return (
              <button
                key={option.id}
                onClick={() => !isLocked && !revealed && onSelectOption(question.id, option.id)}
                disabled={isLocked || revealed}
                className={`relative w-full text-left p-4 md:px-5 md:py-4 rounded-xl border-2 transition-all duration-200 flex items-center justify-between ${!isLocked && !revealed && 'hover:bg-surface-elevated active:scale-[0.99]'} ${isLocked && !isSelected && !isCorrectOption ? 'opacity-40 cursor-not-allowed' : ''} ${isCorrectOption ? 'border-emerald-500/60 bg-emerald-500/10' : isWrongSelection ? 'border-red-500/60 bg-red-500/10' : isSelected ? 'bg-surface-elevated border-border-color ring-1 ring-focus-ring' : 'bg-transparent border-border-color'}`}
              >
                <div className="flex items-center gap-3 md:gap-4 w-full">
                  <div className={`flex-shrink-0 w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center transition-all duration-200 ${isCorrectOption ? 'bg-emerald-500 border-transparent' : isWrongSelection ? 'bg-red-500 border-transparent' : isSelected ? 'bg-primary border-transparent' : 'bg-transparent border-border-color'}`}>
                    {isSelected && !isCorrectOption && !isWrongSelection && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                  </div>
                  <span className={`text-[15px] md:text-[16px] font-['Noto_Sans_Bengali'] leading-snug ${isCorrectOption ? 'text-emerald-700 font-semibold' : isWrongSelection ? 'text-red-700 line-through opacity-80' : isSelected ? 'text-text-primary font-semibold' : 'text-text-secondary font-normal'}`}>
                    <MathDisplay content={pickLang(language, option.text_bn, option.text_en) || option.text} />
                  </span>
                </div>
                {isCorrectOption && (
                  <CheckCircle2 size={20} className="animate-in zoom-in flex-shrink-0 ml-3 rounded-full text-emerald-600" />
                )}
                {isWrongSelection && (
                  <XCircle size={20} className="animate-in zoom-in flex-shrink-0 ml-3 rounded-full text-red-600" />
                )}
                {isSelected && !revealed && (
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

LiveQuestionCard.displayName = 'LiveQuestionCard';

export default LiveQuestionCard;
