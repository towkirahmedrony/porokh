export interface ReferralStats {
  referralCode: string;
  totalReferrals: number;
  totalEarned: number;
  currency: string;
}

export interface ReferralUser {
  id: string;
  full_name: string;
  avatar_url: string | null;
  joined_at: string; // ডাটাবেইজের 'created_at' এর সাথে ম্যাপ হবে
  // ডাটাবেইজের 'account_status' ('active', 'suspended', 'deleted') এবং UI-এর 'pending' স্টেটের সমন্বয়
  status: 'active' | 'pending' | 'suspended' | 'deleted'; 
}

export interface ReferralHistoryItem {
  user: ReferralUser;
  bonus_amount: number; // coin_transactions টেবিল অনুযায়ী
}
