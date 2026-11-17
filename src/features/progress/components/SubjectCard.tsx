import React, { memo } from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';

interface SubjectCardProps {
  subject: string;
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
}

export const SubjectCard: React.FC<SubjectCardProps> = memo(({ 
  subject, 
  score = 0, 
  correct = 0, 
  wrong = 0, 
  skipped = 0 
}) => {
  const { language, t } = useLanguage();

  return (
    <div className="rounded-xl p-5 transition-colors group shadow-sm bg-card-bg border border-card-border hover:border-border-color">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-lg font-bold transition-colors text-text-primary">
          {subject}
        </h4>
        <span className={`text-lg font-bold ${score > 0 ? 'text-text-primary' : 'text-text-secondary'}`}>
          {localizeDigits(score, language)}%
        </span>
      </div>
      
      {/* Custom Progress Bar */}
      <div className="h-2 w-full rounded-full mb-4 overflow-hidden bg-secondary">
        <div 
          className={`h-full transition-all duration-500 ease-out bg-primary ${score > 0 ? 'opacity-100' : 'opacity-30'}`}
          style={{ width: `${score > 0 ? score : 5}%` }}
        />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-text-secondary">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span><span className="font-bold text-text-primary">{localizeDigits(correct, language)}</span> {t('progress.correct')}</span>
        </div>
        <div className="flex items-center gap-1.5 text-text-secondary">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span><span className="font-bold text-text-primary">{localizeDigits(wrong, language)}</span> {t('progress.wrong')}</span>
        </div>
        <div className="flex items-center gap-1.5 text-text-secondary">
          <div className="w-2 h-2 rounded-full bg-orange-400" />
          <span><span className="font-bold text-text-primary">{localizeDigits(skipped, language)}</span> {t('progress.skipped')}</span>
        </div>
      </div>
    </div>
  );
});

SubjectCard.displayName = 'SubjectCard';
