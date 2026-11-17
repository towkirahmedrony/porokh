import type { AppLanguage } from '@/shared/i18n/messages';

export const calculateXP = (correct: number, wrong: number, total: number): number => {

  const correctXP = correct * 2.5;
  const penaltyXP = wrong * 0.5;
  
  let totalXP = correctXP - penaltyXP;
  
  // Bonus Rule: > 80% marks
  if (total > 0) {
    const percentage = (correct / total) * 100;
    if (percentage > 80) {
      totalXP += 10;
    }
  }
  
  // XP cannot be negative logic - Added Math.max to prevent negative value in Database
  return Math.max(0, parseFloat(totalXP.toFixed(2)));
};

export const formatBoardRef = (ref?: string, language: AppLanguage = 'bn') => {
  if (!ref) return null;
  // Simple mapping for short forms
  const map: Record<string, string> = {
    'Dhaka Board': 'ঢা.বো',
    'Rajshahi Board': 'রা.বো',
    'Cumilla Board': 'কু.বো',
    'Jashore Board': 'য.বো',
    'Chittagong Board': 'চ.বো',
    'Barishal Board': 'ব.বো',
    'Sylhet Board': 'সি.বো',
    'Dinajpur Board': 'দি.বো',
    'Mymensingh Board': 'ম.বো',
    'Madrasah Board': 'মা.বো',
    'Technical Board': 'কা.বো'
  };

  // Check if year exists (e.g. "Dhaka Board 2024")
  const parts = ref.split(' ');
  const year = parts[parts.length - 1]; // Last part is likely year
  const boardName = parts.slice(0, parts.length - 1).join(' ');

  if (map[boardName]) {
    const short = language === 'en' ? boardName.replace(/ Board$/, '') : map[boardName];
    return `${short}:${year.slice(-2)}`; // 2024 -> 24
  }
  return ref;
};
