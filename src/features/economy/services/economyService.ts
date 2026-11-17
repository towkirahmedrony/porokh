import apiClient from '@/shared/lib/apiClient';
import { MarketplaceItem, PurchaseResponse } from '../types/economy';
import type { AppLanguage } from '@/shared/i18n/messages';

export const economyService = {
  // ইউজারের বর্তমান ব্যালেন্স দেখা
  getUserBalance: async () => {
    const response = await apiClient.get('/user/balance');
    // ব্যাকএন্ডের sendResponse ফরম্যাট হ্যান্ডেল করা হলো (response.data.data)
    return response.data?.data?.coin_balance || response.data?.coin_balance || 0;
  },

  // মার্কেটপ্লেসের আইটেম লিস্ট আনা
  getMarketplaceItems: async (language: AppLanguage = 'bn'): Promise<MarketplaceItem[]> => {
    const response = await apiClient.get('/marketplace/items', { params: { lang: language } });
    // FIXED: res.data.data থেকে অ্যারে বের করা হলো, যাতে .map() ক্র্যাশ না করে
    return response.data?.data || response.data || [];
  },

  // আইটেম কেনা
  purchaseItem: async (itemId: string): Promise<PurchaseResponse> => {
    const response = await apiClient.post('/marketplace/purchase', { item_id: itemId });
    return response.data?.data || response.data;
  }
};
