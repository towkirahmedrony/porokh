import React from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';

interface ProgressHeaderProps {
  user?: {
    name?: string;
    batch?: string;
  };
}

export const ProgressHeader: React.FC<ProgressHeaderProps> = ({ user }) => {
  const { t } = useLanguage();

  // Safe fallbacks to prevent crashes
  const userName = user?.name || t('home.studentFallback');
  const userBatch = user?.batch || t('progress.batchFallback');
  const initial = userName.charAt(0).toUpperCase();

  return (
    <div className="rounded-2xl p-6 shadow-sm relative overflow-hidden bg-card-bg border border-card-border">
      <div className="flex justify-between items-start relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-full flex items-center justify-center text-2xl font-bold shadow-md bg-primary text-primary-foreground border-2 border-card-border">
            {initial}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary">
              {userName}
            </h1>
            <span className="inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-medium bg-badge-bg text-badge-text border border-border-color">
              {t('progress.batch', { batch: userBatch })}
            </span>
          </div>
        </div>
      </div>
      <div className="absolute top-0 right-0 w-64 h-64 blur-[80px] rounded-full pointer-events-none bg-accent opacity-10"></div>
    </div>
  );
};
