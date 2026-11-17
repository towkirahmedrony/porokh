import React from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { GroupLeaderboardResponse, Squad } from '../types/groupLeaderboard';
import { SquadRow } from './SquadRow';
import { NoSquadCTA } from './NoSquadCTA';
import { Trophy, X } from 'lucide-react';

interface GroupLeaderboardProps {
  data: GroupLeaderboardResponse | null;
  isLoading: boolean;
  onClose: () => void;
}

export const GroupLeaderboard: React.FC<GroupLeaderboardProps> = ({ data, isLoading, onClose }) => {
  const { t } = useLanguage();
  if (isLoading || !data) {
    return (
      <div className="bg-app flex flex-col h-full p-8 items-center justify-center">
        <div className="bg-surface border border-border-color animate-pulse w-12 h-12 rounded-full mb-4"></div>
        <div className="text-text-secondary">{t('leaderboard.loading')}</div>
      </div>
    );
  }

  const { has_group, my_group, top_groups = [] } = data;

  return (
    <div className="bg-app flex flex-col h-full overflow-hidden relative">
      {/* Header */}
      <div className="bg-card-bg border-b border-border-color px-4 py-4 sticky top-0 z-20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="text-primary w-5 h-5" />
          <div>
            <h1 className="text-text-primary font-bold text-lg leading-none">
              {t('leaderboard.weeklyTitle')}
            </h1>
            <span className="text-text-secondary text-xs mt-1 block">
              {t('leaderboard.weeklySubtitle')}
            </span>
          </div>
        </div>
        <button 
          onClick={onClose} 
          aria-label={t('common.close')}
          className="hover:bg-surface-elevated p-2 rounded-full transition-colors"
        >
          <X className="text-text-secondary w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-20">
        {/* Case 1: User has a group */}
        {has_group && my_group && (
          <div className="bg-card-bg border-b border-border-color shadow-sm sticky top-0 z-10">
            <div className="bg-surface text-text-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider">
              ⭐ {t('leaderboard.yourSquad')} ⭐
            </div>
            <SquadRow squad={my_group} isPinned={true} />
          </div>
        )}

        {/* Top Squads List */}
        <div className="bg-card-bg">
          <div className="bg-surface text-text-secondary border-y border-border-color px-4 py-3 text-xs font-bold uppercase tracking-wider">
            👑 {t('leaderboard.topSquads')} 👑
          </div>
          <div>
            {top_groups.map((squad: Squad) => (
              <SquadRow key={squad.id} squad={squad} />
            ))}
          </div>
        </div>

        {/* Case 2: User does not have a group */}
        {!has_group && <NoSquadCTA />}
      </div>
    </div>
  );
};
