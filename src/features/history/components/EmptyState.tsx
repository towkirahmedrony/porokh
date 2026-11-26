import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import Lottie from 'lottie-react';
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
    <div className="flex flex-col items-center justify-center rounded-[20px] bg-card-bg px-5 py-10 text-center animate-in fade-in duration-300 motion-reduce:animate-none">
      <div className="pointer-events-none mb-2 h-44 w-44" aria-hidden="true">
        <Lottie 
          animationData={searchAnim}
          loop={true}
          autoplay={true}
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      <h3 className="mb-1 text-[15px] font-bold leading-6 text-text-primary">
        {t(current.titleKey)}
      </h3>
      <p className="mx-auto mb-6 max-w-xs text-[13px] leading-6 text-text-secondary">
        {t(current.descKey)}
      </p>

      <button
        type="button"
        onClick={() => navigate(current.link)}
        className="min-h-[44px] rounded-xl bg-primary px-6 text-[13px] font-bold text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        {t(current.btnKey)}
      </button>
    </div>
  );
});

EmptyState.displayName = 'EmptyState';
