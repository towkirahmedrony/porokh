import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/shared/lib/apiClient'; // পাথ ঠিক করা হয়েছে
import toast from 'react-hot-toast'; // react-hot-toast ইম্পোর্ট করা হয়েছে

// Types based on the backend service response
export interface ReferralStats {
  referralCode: string;
  totalReferrals: number;
  totalEarned: number;
  currency: string;
}

export interface ReferredUser {
  id: string;
  full_name: string;
  avatar_url: string | null;
  joined_at: string;
  status: 'active' | 'pending';
}

export interface ReferralHistoryItem {
  user: ReferredUser;
  bonus_amount: number;
}

export const useReferral = () => {
  const queryClient = useQueryClient();

  // Fetch Referral Stats
  const getStats = useQuery({
    queryKey: ['referralStats'],
    queryFn: async (): Promise<ReferralStats> => {
      // আপনার ব্যাকএন্ড রাউট অনুযায়ী এন্ডপয়েন্ট (যেমন: /api/referral/stats)
      const res = await apiClient.get('/referral/stats'); 
      return res.data.data;
    }
  });

  // Fetch Referral History
  const getHistory = useQuery({
    queryKey: ['referralHistory'],
    queryFn: async (): Promise<ReferralHistoryItem[]> => {
      const res = await apiClient.get('/referral/history');
      return res.data.data;
    }
  });

  // Redeem Code Mutation
  const redeemCode = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiClient.post('/referral/redeem', { code });
      return res.data;
    },
    onSuccess: (data) => {
      // react-hot-toast এর success মেথড ব্যবহার করা হয়েছে
      toast.success(data.message || 'Referral code applied successfully!');
      
      // আপডেট হওয়ার পর ডাটা রিফ্রেশ করা
      queryClient.invalidateQueries({ queryKey: ['userProfile'] }); 
      queryClient.invalidateQueries({ queryKey: ['referralStats'] });
      queryClient.invalidateQueries({ queryKey: ['referralHistory'] });
    },
    onError: (error: any) => {
      // react-hot-toast এর error মেথড ব্যবহার করা হয়েছে
      toast.error(error.response?.data?.message || error.message || 'Invalid or expired code.');
    }
  });

  return {
    stats: getStats,
    history: getHistory,
    redeemCode,
  };
};
