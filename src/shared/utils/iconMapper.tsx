import { 
  BookOpen, 
  Video, 
  FileQuestion, 
  Calculator, 
  Layout, 
  Activity, 
  Brain,
  GraduationCap,
  Zap,            // Physics
  FlaskConical,   // Chemistry
  Dna,            // Biology
  Globe,          // English
  Leaf,           // Botany
  Trophy,         // Leaderboard / Achievements
  Users,          // Study Groups
  Swords,         // Battles / Arena
  Target,         // Focus / Quests
  Gift            // Rewards / Coins
} from "lucide-react";

export const getIconByName = (iconName?: string | null) => {
  // Handle null/undefined gracefully
  if (!iconName) return BookOpen;

  // Normalize the input to handle case-insensitive matches from DB
  const name = iconName.toLowerCase().trim();

  switch (name) {
    // --- Core/Existing UI Icons ---
    case "bookopen": return BookOpen;
    case "video": return Video;
    case "filequestion": return FileQuestion;
    case "layout": return Layout;
    case "activity": return Activity; // Can be used for Zoology/Activity
    case "brain": return Brain;
    case "graduationcap": return GraduationCap;
    
    // --- Subject Icons (Matches 'subjects' table slugs/names) ---
    case "physics":
    case "padarthobigyan":
    case "zap":
      return Zap;
    case "chemistry":
    case "rasayan":
    case "flaskconical":
      return FlaskConical;
    case "biology":
    case "jibbigyan":
    case "dna":
      return Dna;
    case "math":
    case "higher_math":
    case "calculator":
      return Calculator;
    case "english":
    case "globe":
      return Globe;
    case "botany":
    case "leaf":
      return Leaf;
    case "zoology":
      return Activity;

    // --- Enterprise/Gamification Icons (Matches 'home_grids', 'daily_quests' etc.) ---
    case "trophy":
    case "leaderboard":
    case "achievement":
      return Trophy;
    case "users":
    case "group":
    case "study_group":
      return Users;
    case "swords":
    case "battle":
    case "arena":
      return Swords;
    case "target":
    case "quest":
    case "focus":
      return Target;
    case "gift":
    case "reward":
    case "bonus":
      return Gift;
      
    // Default Fallback
    default: return BookOpen;
  }
};
