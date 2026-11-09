import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Lock } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';

// DB 'achievements_master' টেবিলের সাথে সামঞ্জস্যপূর্ণ
interface Badge {
  id: string;
  title: string;
  icon_url: string | null;
  is_earned: boolean;
}

const BadgeShowcase: React.FC<{ badges: Badge[] }> = ({ badges }) => {
  const { t } = useLanguage();
  return (
    <div className="py-2 mb-20">
      <div className="px-6 mb-4 flex justify-between items-end">
        <h3 className="text-lg font-bold font-['Noto_Sans_Bengali'] text-text-primary">
{t('profile.achievements')}
        </h3>
        <span className="text-xs font-['Noto_Sans_Bengali'] text-text-secondary">
{t('profile.unlockedCount', { done: badges.filter(b => b.is_earned).length, total: badges.length })}
        </span>
      </div>

      <div className="flex overflow-x-auto pb-4 px-4 gap-4 scrollbar-hide snap-x">
        {badges.map((badge, index) => (
          <motion.div
            key={badge.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={clsx(
              "flex-shrink-0 w-24 flex flex-col items-center gap-2 snap-center",
              !badge.is_earned && "opacity-60 grayscale"
            )}
          >
            <div 
              className={clsx(
                "relative w-16 h-16 flex items-center justify-center rounded-full border overflow-hidden p-3 transition-colors",
                badge.is_earned 
                  ? "bg-surface-elevated border-border-color shadow-md" 
                  : "bg-surface border-border-color shadow-sm"
              )}
            >
              {/* Image render করা হচ্ছে icon_url এর জন্য */}
              {badge.icon_url ? (
                <img src={badge.icon_url} alt={badge.title} className="w-full h-full object-contain drop-shadow-md" />
              ) : (
                <span className="text-3xl">🏆</span>
              )}
              
              {!badge.is_earned && (
                <div className="absolute inset-0 flex items-center justify-center backdrop-blur-[1px] bg-surface/60">
                  <Lock className="w-5 h-5 text-text-secondary" />
                </div>
              )}
            </div>
            <span className="text-xs text-center font-medium line-clamp-2 leading-tight font-['Noto_Sans_Bengali'] text-text-primary">
              {badge.title}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default BadgeShowcase;
