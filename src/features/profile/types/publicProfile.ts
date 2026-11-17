export interface PublicProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  batch_year: string | null; 
  
  // Database fields directly from 'profiles' table (Replacing league_info)
  pvp_rating: number | null;
  total_xp: number | null;
  
  // Derived from exam_history / subject data
  top_skills: {
    subject: string;
    score: number; 
    fullMark: number;
  }[];
  
  // Parsed from 'achievements (jsonb)' in profiles table + achievements_master
  badges: {
    id: string;
    title: string;             // DB 'achievements_master.title'
    icon_url: string | null;   // DB 'achievements_master.icon_url'
    is_earned: boolean;
  }[];
}

// DB 'profiles' এবং 'exam_history' এর অ্যাগ্রিগেটেড ডাটার টাইপ
export interface PlayerStats {
  total_xp: number;         // DB: profiles.total_xp
  accuracy: number;         // DB: exam_history থেকে ক্যালকুলেটেড (%)
  current_streak: number;   // DB: profiles.current_streak
  total_exams: number;      // DB: exam_history থেকে ক্যালকুলেটেড
}

export interface VersusStats {
  my_stats: PlayerStats;
  their_stats: PlayerStats;
}
