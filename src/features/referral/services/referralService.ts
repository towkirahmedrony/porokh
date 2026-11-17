import { supabase } from '@/shared/lib/supabase';
import { ReferralStats, ReferralHistoryItem } from '../types/referral';

export const referralService = {
  // ১. ইউজারের স্ট্যাটস এবং কোড আনা
  getStats: async (userId: string): Promise<ReferralStats> => {
    // প্রোফাইল থেকে রেফারাল কোড আনা
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('referral_code') 
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    // মোট কতজন জয়েন করেছে (referred_by = userId)
    const { count, error: countError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('referred_by', userId);

    if (countError) throw countError;

    // coin_transactions টেবিল থেকে 'referral_bonus' এর মোট আয় হিসাব করা
    const { data: transactions, error: txError } = await supabase
      .from('coin_transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('transaction_type', 'referral_bonus');

    if (txError) throw txError;

    // প্রাপ্ত কয়েনগুলোর যোগফল বের করা
    const totalEarned = transactions?.reduce((sum, tx) => sum + (tx.amount || 0), 0) || 0;

    return {
      referralCode: profile?.referral_code || 'GENERATE',
      totalReferrals: count || 0,
      totalEarned: totalEarned,
      currency: 'Coins'
    };
  },

  // ২. রেফারাল হিস্টোরি আনা
  getHistory: async (userId: string): Promise<ReferralHistoryItem[]> => {
    // app_configs থেকে ডায়নামিক বোনাস অ্যামাউন্ট আনা
    const { data: configData, error: configError } = await supabase
      .from('app_configs')
      .select('value')
      .eq('key', 'referral_bonus_amount')
      .single();
      
    // যদি কোনো কারণে config না পাওয়া যায় বা সেট করা না থাকে, তবে ডিফল্ট 100 ব্যবহার হবে
    let currentBonus = 100;
    if (!configError && configData?.value) {
       currentBonus = Number(configData.value);
    }

    // প্রোফাইল থেকে রেফার করা ইউজারদের ডাটা আনা
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, created_at, account_status')
      .eq('referred_by', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((user: any) => ({
      user: {
        id: user.id,
        full_name: user.full_name || '',
        avatar_url: user.avatar_url,
        joined_at: user.created_at,
        status: user.account_status === 'active' ? 'active' : 'pending',
      },
      bonus_amount: currentBonus, // এখন এটি ডায়নামিক
    }));
  },

  // ৩. কোড রিডিম করা (Secure RPC Call)
  redeemCode: async (userId: string, code: string) => {
    if (!code) throw new Error("Referral code is required");
    
    // ডাটাবেইজ লেভেলে ট্রানজ্যাকশন মেইনটেইন করার জন্য RPC ব্যবহার করা হলো
    const { error } = await supabase.rpc('apply_referral_code' as any, {
      p_user_id: userId,
      p_referral_code: code
    });

    if (error) {
      throw new Error(error.message || "Failed to apply referral code.");
    }

    return { success: true };
  }
};
