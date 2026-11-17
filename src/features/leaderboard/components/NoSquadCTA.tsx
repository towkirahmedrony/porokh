import React from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { Users, Plus } from 'lucide-react';

interface NoSquadCTAProps {
  onJoin?: () => void;
  onCreate?: () => void;
}

export const NoSquadCTA: React.FC<NoSquadCTAProps> = ({ onJoin, onCreate }) => {
  const { t } = useLanguage();
  return (
    <div className="border border-border-color bg-card-bg rounded-xl p-6 m-4 text-center mt-6 shadow-sm">
      <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 bg-secondary">
        <Users className="w-6 h-6 text-text-secondary" />
      </div>
      <h3 className="font-bold text-lg mb-2 text-text-primary">
        {t('leaderboard.noSquad')}
      </h3>
      <p className="text-sm mb-6 text-text-secondary">
        {t('leaderboard.noSquadDescription')}
      </p>
      
      <div className="flex flex-col gap-3">
        <button 
          onClick={onJoin}
          className="font-bold py-3 px-4 rounded-lg w-full flex items-center justify-center gap-2 hover:opacity-90 transition-opacity bg-primary text-primary-foreground"
        >
          <Users className="w-4 h-4" />
          {t('leaderboard.joinSquad')}
        </button>
        <button 
          onClick={onCreate}
          className="font-semibold py-3 px-4 rounded-lg w-full flex items-center justify-center gap-2 border transition-colors bg-secondary text-text-primary border-border-color hover:bg-surface-elevated"
        >
          <Plus className="w-4 h-4" />
          {t('leaderboard.createSquad')}
        </button>
      </div>
    </div>
  );
};
