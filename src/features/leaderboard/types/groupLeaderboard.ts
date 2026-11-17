export interface Squad {
  id: string;
  name: string;
  icon: string | null;         // study_groups.icon
  group_level: number;         // study_groups.group_level 
  total_xp: number;            // study_groups.total_xp 
  rank: number;                // group_leaderboard_cache.rank
}

export interface GroupLeaderboardResponse {
  has_group: boolean;          
  my_group: Squad | null;      
  myGroup?: Squad | null;      // Optional fallback for backend casing inconsistencies
  top_groups: Squad[];         
}
