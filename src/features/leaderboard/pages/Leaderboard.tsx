import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { PanInfo } from 'framer-motion';
import { getLeagueInfo } from '../utils/leagueConstants';
import { UserRow } from '../components/UserRow';
import { LeagueHeader } from '../components/LeagueHeader';
import LeaderboardSkeleton from '../components/LeaderboardSkeleton';
import { useLeaderboard, useLeaguesConfig } from '../hooks/useLeaderboard';
import { useAuth } from '../../auth/hooks/useAuth';

interface UserWithXP {
  id?: string;
  total_score?: number;
  total_xp?: number;
}

const Leaderboard: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { data: leagues = [], isLoading: isLeaguesLoading } = useLeaguesConfig();

  const [stableTotalXP, setStableTotalXP] = useState<number | null>(null);
  const [hasManuallySwiped, setHasManuallySwiped] = useState<boolean>(false);
  const [selectedLeagueIndex, setSelectedLeagueIndex] = useState<number>(0);
  const [direction, setDirection] = useState<number>(0);

  useEffect(() => {
    if (authLoading) return;

    const authUser = user as UserWithXP | null;
    const xp = authUser?.total_score ?? authUser?.total_xp ?? 0;

    setStableTotalXP(prev => {
      if (prev === null) return xp;
      return Math.max(prev, xp);
    });
  }, [user, authLoading]);

  const resolvedXP = stableTotalXP ?? 0;
  const hasResolvedXP = !authLoading && stableTotalXP !== null;

  const myLeagueIndex = useMemo(() => {
    if (!hasResolvedXP || leagues.length === 0) return 0;

    const currentLeague = getLeagueInfo(resolvedXP, leagues);
    if (!currentLeague) return 0;

    const index = leagues.findIndex(l => l.id === currentLeague.id);
    return index >= 0 ? index : 0;
  }, [resolvedXP, leagues, hasResolvedXP]);

  useLayoutEffect(() => {
    if (!hasResolvedXP || leagues.length === 0 || hasManuallySwiped) return;
    setSelectedLeagueIndex(myLeagueIndex);
  }, [hasResolvedXP, leagues.length, hasManuallySwiped, myLeagueIndex]);

  const selectedLeague = leagues[selectedLeagueIndex];
  const nextLeague = leagues[selectedLeagueIndex + 1];
  const prevLeague = leagues[selectedLeagueIndex - 1];

  const { data: leaderboardData = [], isLoading: isLeaderboardLoading } = useLeaderboard(
    selectedLeague?.min_xp ?? 0,
    selectedLeagueIndex === leagues.length - 1 ? null : (nextLeague?.min_xp ?? null),
    Boolean(selectedLeague && hasResolvedXP)
  );

  const currentUser = useMemo(
    () => leaderboardData.find(u => u.is_current_user),
    [leaderboardData]
  );

  useEffect(() => {
    if (!currentUser) return;

    const xp = currentUser.total_score ?? currentUser.total_xp ?? 0;
    setStableTotalXP(prev => {
      if (prev === null) return xp;
      return Math.max(prev, xp);
    });
  }, [currentUser]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  if (authLoading || isLeaguesLoading || !hasResolvedXP || !selectedLeague) {
    return <LeaderboardSkeleton />;
  }

  const isLocked = selectedLeague.min_xp > resolvedXP;
  let progressPercentage = 100;
  let pointsNeeded = 0;

  if (nextLeague) {
    const range = nextLeague.min_xp - selectedLeague.min_xp;

    if (selectedLeagueIndex === myLeagueIndex) {
      const currentInLeague = Math.max(0, resolvedXP - selectedLeague.min_xp);
      progressPercentage = range > 0 ? Math.min(100, (currentInLeague / range) * 100) : 100;
      pointsNeeded = Math.max(0, nextLeague.min_xp - resolvedXP);
    } else if (selectedLeagueIndex > myLeagueIndex) {
      progressPercentage = 0;
      pointsNeeded = Math.max(0, selectedLeague.min_xp - resolvedXP);
    } else {
      progressPercentage = 100;
      pointsNeeded = 0;
    }
  }

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x > 50 && selectedLeagueIndex > 0) handlePrev();
    else if (info.offset.x < -50 && selectedLeagueIndex < leagues.length - 1) handleNext();
  };

  const handlePrev = () => {
    if (!prevLeague) return;
    setHasManuallySwiped(true);
    setDirection(-1);
    setSelectedLeagueIndex(prev => prev - 1);
  };

  const handleNext = () => {
    if (!nextLeague) return;
    setHasManuallySwiped(true);
    setDirection(1);
    setSelectedLeagueIndex(prev => prev + 1);
  };

  return (
    <div className="w-full min-h-screen font-['Noto_Sans_Bengali'] pb-24 pt-[135px] bg-app text-text-primary">
      <LeagueHeader
        selectedLeagueIndex={selectedLeagueIndex}
        selectedLeague={selectedLeague}
        prevLeague={prevLeague}
        nextLeague={nextLeague}
        isLocked={isLocked}
        direction={direction}
        progressPercentage={progressPercentage}
        pointsNeeded={pointsNeeded}
        isCurrentLeague={selectedLeagueIndex === myLeagueIndex}
        onPrev={handlePrev}
        onNext={handleNext}
        onDragEnd={handleDragEnd}
      />

      <div className="px-3 mt-3">
        {isLeaderboardLoading ? (
          <LeaderboardSkeleton rowsOnly />
        ) : (
          <div className="space-y-2.5">
            {leaderboardData.map((leaderboardUser, index) => (
              <UserRow key={leaderboardUser.id} user={leaderboardUser} index={index} />
            ))}
          </div>
        )}
      </div>

      {!isLocked && currentUser && (
        <div className="fixed bottom-[80px] md:bottom-4 left-0 right-0 z-40 px-3 pointer-events-none">
          <div className="max-w-md mx-auto backdrop-blur-md rounded-xl border-t p-1 pointer-events-auto bg-surface-elevated border-primary/50 shadow-xl">
            <UserRow user={currentUser} index={999} isFooter={true} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
