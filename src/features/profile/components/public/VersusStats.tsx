import React, { memo } from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { motion } from 'framer-motion';
import { Trophy, Target, Flame, BookOpen, LucideIcon } from 'lucide-react';

export interface PlayerStats {
  total_xp: number;         
  accuracy: number;         
  current_streak: number;   
  total_exams: number;      
}

interface VersusStatsProps {
  stats: {
    my_stats: PlayerStats;
    their_stats: PlayerStats;
  };
  opponentName?: string;
}

interface StatRowProps {
  icon: LucideIcon;
  label: string;
  myValue: number;
  theirValue: number;
  unit?: string;
}

const StatRow: React.FC<StatRowProps> = ({ icon: Icon, label, myValue, theirValue, unit = '' }) => {
  const iWin = myValue > theirValue;
  const tie = myValue === theirValue;

  return (
    <div className="grid grid-cols-3 items-center py-3 border-b border-border-color last:border-0">
      <div className={`text-center font-bold text-sm font-['Inter'] ${iWin ? 'text-primary' : 'text-text-secondary'}`}>
        {myValue}{unit}
      </div>
      
      <div className="flex flex-col items-center justify-center">
        <Icon className="w-4 h-4 mb-1 text-text-secondary" />
        <span className="text-[10px] font-['Noto_Sans_Bengali'] text-text-secondary">{label}</span>
      </div>

      <div className={`text-center font-bold text-sm font-['Inter'] ${(!iWin && !tie) ? 'text-accent' : 'text-text-secondary'}`}>
        {theirValue}{unit}
      </div>
    </div>
  );
};

const VersusStats: React.FC<VersusStatsProps> = ({ stats, opponentName }) => {
  const { t } = useLanguage();
  const { my_stats, their_stats } = stats;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 -mt-6 relative z-10 rounded-2xl p-5 border shadow-xl bg-card-bg border-card-border"
    >
      <div className="flex justify-between items-center mb-4 px-4">
        <span className="text-xs font-bold font-['Inter'] text-text-secondary">
          {t('leaderboard.you')}
        </span>
        <span className="text-xs font-bold px-3 py-1 rounded-full border bg-badge-bg text-badge-text border-border-color">
          {t('common.vs')}
        </span>
        <span className="text-xs font-bold font-['Inter'] uppercase truncate max-w-[80px] text-right text-text-secondary">
          {opponentName || t('leaderboard.them')}
        </span>
      </div>

      <div className="space-y-1">
        <StatRow icon={Trophy} label={t('leaderboard.xp')} myValue={my_stats?.total_xp || 0} theirValue={their_stats?.total_xp || 0} />
        <StatRow icon={Target} label={t('leaderboard.accuracy')} myValue={my_stats?.accuracy || 0} theirValue={their_stats?.accuracy || 0} unit="%" />
        <StatRow icon={Flame} label={t('profile.streak')} myValue={my_stats?.current_streak || 0} theirValue={their_stats?.current_streak || 0} />
        <StatRow icon={BookOpen} label={t('leaderboard.exams')} myValue={my_stats?.total_exams || 0} theirValue={their_stats?.total_exams || 0} />
      </div>
    </motion.div>
  );
};

export default memo(VersusStats);
