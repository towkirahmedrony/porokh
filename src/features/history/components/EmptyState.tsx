import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import Lottie from 'lottie-react';
import { ArrowRight } from 'lucide-react';
import { TabType } from '../types/history';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { type AppMessageKey } from '@/shared/i18n/messages';
import { EXAM_TYPES, examListPath } from '@/features/exam/constants/examTypes';

import searchAnim from '@/assets/animations/empty-search.json';

interface Props {
  type: TabType;
}

interface EmptyStateConfig {
  titleKey: AppMessageKey;
  descKey: AppMessageKey;
  btnKey: AppMessageKey;
  link: string;
}

const EMPTY_STATE_CONFIG: Record<TabType, EmptyStateConfig> = {
  history: {
    titleKey: 'history.emptyHistoryTitle',
    descKey: 'history.emptyHistoryDesc',
    btnKey: 'history.emptyHistoryBtn',
    link: examListPath(EXAM_TYPES.model.type),
  },
  mistakes: {
    titleKey: 'history.emptyMistakesTitle',
    descKey: 'history.emptyMistakesDesc',
    btnKey: 'history.emptyMistakesBtn',
    link: examListPath(EXAM_TYPES.model.type),
  },
  bookmarks: {
    titleKey: 'history.emptyBookmarksTitle',
    descKey: 'history.emptyBookmarksDesc',
    btnKey: 'history.emptyBookmarksBtn',
    link: '/question-bank',
  },
};

export const EmptyState: React.FC<Props> = memo(({ type }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const current = EMPTY_STATE_CONFIG[type];

  if (!current) return null;

  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center animate-in fade-in zoom-in duration-500">
      
      <div className="w-48 h-48 md:w-60 md:h-60 mb-2 pointer-events-none">
        <Lottie 
          animationData={searchAnim}
          loop={true}
          autoplay={true}
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      <h3 className="text-text-primary text-xl font-bold mb-2 font-['Noto_Sans_Bengali']">
        {t(current.titleKey)}
      </h3>
      <p className="text-text-secondary max-w-xs mx-auto mb-8 font-['Noto_Sans_Bengali'] text-sm">
        {t(current.descKey)}
      </p>

      <button 
        onClick={() => navigate(current.link)}
        className="bg-card-bg border border-border-color hover:bg-surface-elevated group flex items-center space-x-2 px-6 py-3 rounded-full shadow-sm transition-all duration-300 hover:shadow-md active:scale-95"
      >
        <span className="text-primary text-sm font-semibold font-['Noto_Sans_Bengali'] transition-colors">
          {t(current.btnKey)}
        </span>
        <ArrowRight className="text-primary w-4 h-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
      </button>

    </div>
  );
});

EmptyState.displayName = 'EmptyState';
