import React, { useState, useCallback, memo } from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { ArrowRight, ChevronLeft, Clock, FileQuestion, AlertCircle } from 'lucide-react';

export interface ExamConfig {
  questionCount: number;
  duration: number;
  negativeMarking: boolean;
}

interface ExamConfigurationProps {
  topicCount: number;
  onBack: () => void;
  onStartExam: (config: ExamConfig) => void;
}

const ExamConfiguration: React.FC<ExamConfigurationProps> = memo(({ 
  topicCount, 
  onBack, 
  onStartExam 
}) => {
  // Use number | '' to allow the user to completely clear the input field while typing
  const [questionCount, setQuestionCount] = useState<number | ''>(30);
  const [duration, setDuration] = useState<number | ''>(30);
  const [negativeMarking, setNegativeMarking] = useState<boolean>(false);

  const handleStart = useCallback(() => {
    // Ensure we always pass valid positive integers to the parent
    const finalQuestionCount = Math.max(1, Number(questionCount) || 30);
    const finalDuration = Math.max(1, Number(duration) || 30);

    onStartExam({
      questionCount: finalQuestionCount,
      duration: finalDuration,
      negativeMarking
    });
  }, [questionCount, duration, negativeMarking, onStartExam]);

  const handleInput = (
    value: string, 
    setter: React.Dispatch<React.SetStateAction<number | ''>>
  ) => {
    if (value === '') {
      setter('');
      return;
    }
    const num = parseInt(value, 10);
    if (!isNaN(num) && num > 0) {
      setter(num);
    }
  };

  const { t } = useLanguage();
  return (
    <div className="p-4 animate-in slide-in-from-right duration-300 pb-24 bg-app">
      {/* Header */}
      <div className="rounded-xl p-4 mb-6 flex items-center gap-4 sticky top-0 z-10 shadow-lg bg-surface-elevated border border-border-color">
        <button 
          onClick={onBack} 
          aria-label={t('common.back')}
          className="w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-95 bg-secondary border border-border-color text-text-primary hover:opacity-80"
        >
          <ChevronLeft size={22} strokeWidth={2.5} />
        </button>
        <div>
          <h2 className="text-lg font-bold text-text-primary">{t('exam.settings')}</h2>
          <p className="text-xs text-text-secondary">{t('exam.topicsSelected', { count: topicCount })}</p>
        </div>
      </div>

      {/* Configuration Card */}
      <div className="rounded-xl p-5 space-y-6 bg-card-bg border border-card-border">
        
        {/* Input Row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Question Count */}
          <div className="space-y-2">
            <label htmlFor="questionCount" className="text-sm font-medium flex items-center gap-2 text-text-secondary">
              <FileQuestion size={16} /> {t('exam.questions')}
            </label>
            <input
              id="questionCount"
              type="number"
              min="1"
              value={questionCount}
              onChange={(e) => handleInput(e.target.value, setQuestionCount)}
              className="w-full text-center font-bold text-xl rounded-lg py-3 outline-none transition-all bg-input-bg text-text-primary border border-input-border focus:ring-2 focus:ring-focus-ring focus:border-transparent"
            />
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <label htmlFor="duration" className="text-sm font-medium flex items-center gap-2 text-text-secondary">
              <Clock size={16} /> {t('exam.timeMinutes')}
            </label>
            <input
              id="duration"
              type="number"
              min="1"
              value={duration}
              onChange={(e) => handleInput(e.target.value, setDuration)}
              className="w-full text-center font-bold text-xl rounded-lg py-3 outline-none transition-all bg-input-bg text-text-primary border border-input-border focus:ring-2 focus:ring-focus-ring focus:border-transparent"
            />
          </div>
        </div>

        {/* Negative Marking Toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-surface border border-border-color">
          <div className="flex flex-col">
            <span id="negative-marking-label" className="font-medium text-sm text-text-primary">{t('exam.negativeMarking')}</span>
            <span id="negative-marking-desc" className="text-xs text-text-secondary">{t('exam.negativeMarkingHint')}</span>
          </div>
          <button
            role="switch"
            aria-checked={negativeMarking}
            aria-labelledby="negative-marking-label"
            aria-describedby="negative-marking-desc"
            onClick={() => setNegativeMarking(!negativeMarking)}
            className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-offset-2 ${
              negativeMarking ? 'bg-primary' : 'bg-input-bg'
            }`}
          >
            <div 
              className={`w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 bg-surface ${
                negativeMarking ? 'translate-x-6' : 'translate-x-0'
              }`} 
            />
          </button>
        </div>

        {/* Info Note */}
        <div className="flex gap-3 p-3 rounded-lg bg-secondary border border-border-color">
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5 text-text-secondary" />
          <p className="text-xs leading-relaxed text-text-primary">
            {t('exam.settingsHint')}
          </p>
        </div>
      </div>

      {/* Start Exam Button */}
      <div className="fixed bottom-0 left-0 w-full p-4 backdrop-blur z-20 bg-surface-elevated border-t border-border-color">
        <button 
          onClick={handleStart}
          className="w-full font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 text-lg focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-offset-2 bg-primary text-primary-foreground"
        >
          {t('exam.start')}
          <ArrowRight size={20} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
});

ExamConfiguration.displayName = 'ExamConfiguration';

export default ExamConfiguration;
