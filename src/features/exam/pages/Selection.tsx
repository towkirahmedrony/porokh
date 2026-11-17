import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ModelTestScreen from '../components/ModelTestScreen';
import BoardExamTab from '../components/BoardExamTab';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { FreeUsageIndicator } from '@/features/access/components/FreeUsageIndicator';
import {
  EXAM_TAB_CONFIGS,
  EXAM_TYPES,
  examListPath,
  type ExamTabType,
} from '../constants/examTypes';

const MIN_SWIPE_DISTANCE = 50;

interface SelectionProps {
  type: ExamTabType;
}

const Selection: React.FC<SelectionProps> = ({ type }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const activeTab = type;

  const setActiveTab = useCallback((tab: ExamTabType) => {
    navigate(examListPath(tab), { replace: true });
  }, [navigate]);

  const [isDetailView, setIsDetailView] = useState<boolean>(false); 
  
  const touchStartX = useRef<number | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (isDetailView) return; 
    touchStartX.current = e.targetTouches[0].clientX;
  }, [isDetailView]);

  const onTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (isDetailView || touchStartX.current === null) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const distance = touchStartX.current - touchEndX;
    const currentIndex = EXAM_TAB_CONFIGS.findIndex((tab) => tab.type === activeTab);

    const isLeftSwipe = distance > MIN_SWIPE_DISTANCE;
    const isRightSwipe = distance < -MIN_SWIPE_DISTANCE;

    if (isLeftSwipe && currentIndex < EXAM_TAB_CONFIGS.length - 1) {
      setActiveTab(EXAM_TAB_CONFIGS[currentIndex + 1].type);
    } else if (isRightSwipe && currentIndex > 0) {
      setActiveTab(EXAM_TAB_CONFIGS[currentIndex - 1].type);
    }

    touchStartX.current = null;
  }, [isDetailView, activeTab, setActiveTab]);

  return (
    <div 
      className="min-h-screen pb-20 overflow-x-hidden flex flex-col items-center bg-app text-text-primary"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {!isDetailView && (
        <div className="w-full max-w-4xl mx-auto px-3 pt-3">
          <FreeUsageIndicator />
        </div>
      )}

      {!isDetailView && (
        <div className="sticky top-0 z-10 w-full backdrop-blur-md transition-all duration-300 shadow-sm bg-surface/90 border-b border-border-color">
          <div className="flex w-full max-w-4xl mx-auto px-2 sm:px-4">
            {EXAM_TAB_CONFIGS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.type;

              return (
                <button
                  key={tab.type}
                  onClick={() => setActiveTab(tab.type)}
                  className={`flex-1 flex items-center justify-center gap-2.5 py-4 text-[15px] sm:text-base font-semibold transition-colors duration-300 relative rounded-t-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                    isActive ? 'text-primary' : 'text-text-secondary'
                  }`}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                  {t(tab.titleKey)}
                  <div 
                    className={`absolute bottom-0 left-0 w-full h-0.5 transition-opacity duration-300 bg-primary ${
                      isActive ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className={`w-full max-w-4xl mx-auto ${!isDetailView ? "p-4 sm:p-6" : "p-0"}`}>
        {activeTab === EXAM_TYPES.model.type ? (
          <div className={!isDetailView ? "animate-in slide-in-from-left-4 fade-in duration-300" : ""}>
            <ModelTestScreen onViewChange={setIsDetailView} />
          </div>
        ) : (
          <div className={!isDetailView ? "animate-in slide-in-from-right-4 fade-in duration-300" : ""}>
            <BoardExamTab onViewChange={setIsDetailView} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Selection;
