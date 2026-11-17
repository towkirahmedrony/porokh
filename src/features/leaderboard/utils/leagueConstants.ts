import { League } from '../types/leaderboard';

export const getLeagueInfo = (xp: number, leagues: League[]): League | null => {
  if (!leagues || leagues.length === 0) return null;
  
  // Ensure leagues are sorted by min_xp ascending
  const sortedLeagues = [...leagues].sort((a, b) => a.min_xp - b.min_xp);
  
  for (let i = sortedLeagues.length - 1; i >= 0; i--) {
    if (xp >= sortedLeagues[i].min_xp) {
      return sortedLeagues[i];
    }
  }

  return sortedLeagues[0];
};
