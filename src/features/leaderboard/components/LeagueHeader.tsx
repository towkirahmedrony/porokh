import React from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { ChevronLeft, ChevronRight, Lock, Pentagon } from 'lucide-react';
import { League } from '../types/leaderboard';

interface Props {
  selectedLeagueIndex: number;
  prevLeague?: League;
  selectedLeague: League;
  nextLeague?: League;
  isLocked: boolean;
  direction: number;
  progressPercentage: number;
  pointsNeeded: number;
  isCurrentLeague: boolean;
  onPrev: () => void;
  onNext: () => void;
  onDragEnd: (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void;
}

// ১০টি লেভেলের জন্য নতুন কালার গ্রেডিয়েন্ট লজিক
const getLeagueGradientColors = (index: number) => {
  switch (index) {
    case 0: 
    case 1: 
      return { start: '#CD7F32', end: '#8B4513' }; // শিক্ষানবিশ, আগ্রহী (Bronze/Iron)
    case 2: 
    case 3: 
      return { start: '#4682B4', end: '#2F4F4F' }; // মনোযোগী, অধ্যবসায়ী (Steel Blue)
    case 4: 
    case 5: 
      return { start: '#C0C0C0', end: '#808080' }; // কুশলী, মেধাবী (Silver)
    case 6: 
    case 7: 
      return { start: '#FFD700', end: '#B8860B' }; // পারদর্শী, বিশারদ (Gold)
    case 8: 
      return { start: '#9370DB', end: '#4B0082' }; // অদম্য (Amethyst/Epic)
    case 9: 
      return { start: '#00FFFF', end: '#008B8B' }; // কিংবদন্তি (Diamond/Legendary)
    default: 
      return { start: '#C0C0C0', end: '#808080' }; // Default Silver
  }
};

export const LeagueHeader: React.FC<Props> = ({
  selectedLeagueIndex, prevLeague, selectedLeague, nextLeague,
  isLocked, direction, progressPercentage, pointsNeeded, isCurrentLeague,
  onPrev, onNext, onDragEnd
}) => {
  const { language, t } = useLanguage();
  const gradientColors = getLeagueGradientColors(selectedLeagueIndex);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b shadow-xl transition-all duration-300 bg-surface-elevated border-border-color">
      {/* Carousel Row */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 h-[110px]">
          
          <button 
            onClick={onPrev}
            aria-label={t('leaderboard.previousLeague')}
            disabled={!prevLeague}
            className={`
              relative flex flex-col items-center justify-center w-14 h-14 rounded-full transition-all duration-300 outline-none
              ${prevLeague ? 'cursor-pointer active:scale-90 hover:bg-secondary opacity-100' : 'invisible pointer-events-none opacity-0'}
            `}
          >
            {prevLeague && (
                <>
                  <div className="absolute inset-0 blur-xl rounded-full bg-primary/20"></div>
                  <div className="relative z-10 flex flex-col items-center">
                      {prevLeague.badge_url && (
                        <img 
                            src={prevLeague.badge_url} 
                            className="w-10 h-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] filter brightness-110 object-contain" 
                            alt={t('leaderboard.previousLeague')}
                        />
                      )}
                      <ChevronLeft className="w-6 h-6 -mt-1 drop-shadow-md stroke-[3] text-text-primary" />
                  </div>
                </>
            )}
          </button>

          <div className="flex-1 flex flex-col items-center justify-center relative -mt-1">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div 
                key={selectedLeagueIndex}
                custom={direction}
                initial={{ x: direction * 40, opacity: 0, scale: 0.8 }}
                animate={{ x: 0, opacity: 1, scale: 1 }}
                exit={{ x: direction * -40, opacity: 0, scale: 0.8 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={onDragEnd}
                className="flex flex-col items-center cursor-grab active:cursor-grabbing"
              >
                <div className="relative w-16 h-16 flex items-center justify-center drop-shadow-[0_8px_10px_rgba(0,0,0,0.6)]">
                    <Pentagon 
                      className={`w-full h-full drop-shadow-lg ${isLocked ? 'text-border-color' : 'text-transparent'}`}
                      style={{ 
                          fill: isLocked ? 'currentColor' : `url(#gradient-${selectedLeague.id})`,
                          stroke: isLocked ? 'currentColor' : 'white',
                          strokeWidth: 2,
                          fillOpacity: isLocked ? 0.5 : 1
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      {isLocked ? (
                          <Lock className="w-6 h-6 text-text-secondary" />
                      ) : (
                          selectedLeague.badge_url && (
                            <img src={selectedLeague.badge_url} className="w-8 h-8 drop-shadow-md object-contain" alt="" />
                          )
                      )}
                    </div>

                    <svg width="0" height="0" className="absolute">
                      <linearGradient id={`gradient-${selectedLeague.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop stopColor={gradientColors.start} offset="0%" />
                        <stop stopColor={gradientColors.end} offset="100%" />
                      </linearGradient>
                    </svg>
                </div>
                
                <h2 className="text-lg font-bold tracking-wide mt-1 text-shadow-sm text-text-primary">
                  {language === 'en' ? selectedLeague.name_en || selectedLeague.name_bn : selectedLeague.name_bn}
                </h2>
              </motion.div>
            </AnimatePresence>
          </div>

          <button 
            onClick={onNext}
            aria-label={t('leaderboard.nextLeague')}
            disabled={!nextLeague}
            className={`
              relative flex flex-col items-center justify-center w-14 h-14 rounded-full transition-all duration-300 outline-none
              ${nextLeague ? 'cursor-pointer active:scale-90 hover:bg-secondary opacity-100' : 'invisible pointer-events-none opacity-0'}
            `}
          >
            {nextLeague && (
                <>
                  <div className="absolute inset-0 blur-xl rounded-full bg-primary/20"></div>
                  <div className="relative z-10 flex flex-col items-center">
                      {nextLeague.badge_url && (
                        <img 
                            src={nextLeague.badge_url} 
                            className="w-10 h-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] filter brightness-110 object-contain" 
                            alt={t('leaderboard.nextLeague')}
                        />
                      )}
                      <ChevronRight className="w-6 h-6 -mt-1 drop-shadow-md stroke-[3] text-text-primary" />
                  </div>
                </>
            )}
          </button>
      </div>

      {nextLeague && (
          <div className="px-8 pb-3 -mt-1">
              <div className="h-2 w-full rounded-full overflow-hidden border relative bg-secondary border-border-color">
                  <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercentage}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={`h-full rounded-full ${!isLocked ? 'bg-gradient-to-r from-primary to-accent' : 'bg-border-color'}`}
                  />
              </div>
              {!isLocked && isCurrentLeague && (
                  <p className="text-center text-[10px] mt-1 text-text-secondary">
                      {t('leaderboard.nextProgress', { points: pointsNeeded })}
                  </p>
              )}
          </div>
      )}
    </div>
  );
};
