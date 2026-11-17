import React, { useState } from 'react';
import { Flame, Trophy } from 'lucide-react';
import { GroupLeaderboard } from '../components/GroupLeaderboard';
import { useSquadLeaderboard } from '../hooks/useLeaderboard';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';

const Lobby: React.FC = () => {
  const { language, t } = useLanguage();
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState<boolean>(false);
  const { data: squadData, isLoading } = useSquadLeaderboard();

  // Data is already normalized by the hook, safely access my_group directly
  const myGroup = squadData?.my_group;

  return (
    <div className="flex flex-col min-h-screen relative pb-20 bg-app">
      {/* Header Section */}
      <div className="p-4 shadow-sm flex justify-between items-center border-b sticky top-0 z-10 bg-card-bg border-border-color">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{myGroup?.icon || '🛡️'}</span>
          <div>
            <h1 className="font-bold text-lg text-primary">
              {myGroup?.name || t('leaderboard.noSquad')}
            </h1>
            <p className="text-xs font-medium text-text-secondary">
              {myGroup
                ? t('leaderboard.level', { level: localizeDigits(myGroup.group_level ?? 1, language) })
                : t('leaderboard.joinPrompt')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-accent/20">
            <Flame className="w-4 h-4 text-accent" />
            <span className="font-bold text-sm text-accent">{localizeDigits(12, language)}</span>
          </div>
          <button 
            onClick={() => setIsLeaderboardOpen(true)}
            aria-label={t('leaderboard.open')}
            className="p-2 rounded-full hover:bg-secondary transition-colors"
          >
            <Trophy className="w-6 h-6 text-primary" />
          </button>
        </div>
      </div>

      {/* ... (বাকি ট্রায়াঙ্গেল এবং অ্যাকশন বাটন কোড আগের মতোই থাকবে) ... */}
      <div className="p-4 flex-1 flex items-center justify-center">
         <p className="text-text-secondary">{t('leaderboard.lobbyPlaceholder')}</p>
      </div>

      {/* Leaderboard Overlay */}
      {isLeaderboardOpen && (
        <div className="fixed inset-0 z-[100] w-full h-[100dvh] bg-app">
          <GroupLeaderboard 
            data={squadData || null}
            isLoading={isLoading}
            onClose={() => setIsLeaderboardOpen(false)}
          />
        </div>
      )}
    </div>
  );
};

export default Lobby;
