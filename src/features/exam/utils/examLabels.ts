import type { AppLanguage } from '@/shared/i18n/messages';

const BOARD_LABELS_EN: Record<string, string> = {
  'ঢাকা বোর্ড': 'Dhaka Board',
  'রাজশাহী বোর্ড': 'Rajshahi Board',
  'কুমিল্লা বোর্ড': 'Cumilla Board',
  'যশোর বোর্ড': 'Jashore Board',
  'চট্টগ্রাম বোর্ড': 'Chittagong Board',
  'বরিশাল বোর্ড': 'Barishal Board',
  ' সিলেট বোর্ড': 'Sylhet Board',
  'দিনাজপুর বোর্ড': 'Dinajpur Board',
  'ময়মনসিংহ বোর্ড': 'Mymensingh Board',
  'মাদ্রাসা বোর্ড': 'Madrasah Board',
  'কারিগরি বোর্ড': 'Technical Board',
};

export const localizeBoardName = (
  board: string,
  language: AppLanguage
): string =>
  language === 'en' ? BOARD_LABELS_EN[board] ?? board : board;
