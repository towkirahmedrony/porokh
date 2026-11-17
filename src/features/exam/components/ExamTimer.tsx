import React, { memo } from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { Clock } from 'lucide-react';
import clsx from 'clsx';

interface ExamTimerProps {
  seconds: number;
  layout?: 'compact' | 'card';
  /** Optional localized label; existing callers keep the Bengali default. */
  label?: string;
}

const formatTime = (totalSeconds: number): string => {
  const safeSeconds = Math.max(0, totalSeconds);
  const m = Math.floor(safeSeconds / 60);
  const s = safeSeconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const ExamTimer: React.FC<ExamTimerProps> = memo(({ seconds, layout = 'compact', label }) => {
  const { t } = useLanguage();
  const resolvedLabel = label ?? t('exam.timeLeft');
  const isUrgent = seconds < 300 && seconds > 0;
  const timeString = formatTime(seconds);

  if (layout === 'card') {
    return (
      <div 
        className={clsx(
          "flex flex-col items-center justify-center p-6 rounded-2xl border transition-colors duration-500",
          isUrgent 
            ? "bg-accent border-transparent text-primary-foreground animate-pulse shadow-sm" 
            : "bg-card-bg border-card-border text-text-primary"
        )}
      >
        <div className={clsx(
          "flex items-center gap-2 mb-2 opacity-80",
          isUrgent ? "text-primary-foreground" : "text-text-secondary"
        )}>
          <Clock size={18} />
          <span className="text-sm font-medium">
            {resolvedLabel}
          </span>
        </div>
        <div className="text-4xl font-mono font-bold tracking-tight">
          {timeString}
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono font-bold transition-colors duration-300 border",
        isUrgent 
          ? "bg-accent border-transparent text-primary-foreground animate-pulse" 
          : "bg-surface border-border-color text-text-primary"
      )}
    >
      <Clock size={16} className={clsx(isUrgent && "animate-pulse")} />
      <span className="text-sm tracking-wider">{timeString}</span>
    </div>
  );
});

ExamTimer.displayName = 'ExamTimer';

export default ExamTimer;
