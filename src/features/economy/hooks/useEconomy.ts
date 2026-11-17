import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { economyService } from '../services/economyService';
import { useLanguage } from '@/shared/i18n/LanguageProvider';

export const useEconomy = () => {
  const queryClient = useQueryClient();
  const { language } = useLanguage();

  // ইউজারের বর্তমান কয়েন ব্যালেন্স ফেচ করা
  const { 
    data: coinBalance = 0, 
    isLoading: isCoinsLoading,
    error: coinsError,
    refetch: refetchBalance
  } = useQuery({
    queryKey: ['userCoinBalance'],
    queryFn: economyService.getUserBalance,
    staleTime: 1000 * 60 * 5, // ৫ মিনিট পর্যন্ত ক্যাশ ধরে রাখবে, বারবার API কল হবে না
  });

  // মার্কেটপ্লেসের আইটেম ফেচ করা
  const { 
    data: marketplaceItems = [], 
    isLoading: isItemsLoading,
    error: itemsError,
    refetch: refetchItems
  } = useQuery({
    queryKey: ['marketplaceItems', language],
    queryFn: () => economyService.getMarketplaceItems(language),
    staleTime: 1000 * 60 * 30, // আইটেম সহজে চেঞ্জ হয় না, তাই ৩০ মিনিট ক্যাশ থাকবে
  });

  // আইটেম কেনার মিউটেশন
  const purchaseMutation = useMutation({
    mutationFn: economyService.purchaseItem,
    onSuccess: (data) => {
      // Optimistic Update: API থেকে রেসপন্স আসার সাথে সাথেই ক্যাশে ব্যালেন্স আপডেট করা
      if (data && data.new_balance !== undefined) {
        queryClient.setQueryData(['userCoinBalance'], data.new_balance);
      }
      
      // ব্যাকগ্রাউন্ডে ইনভ্যালিডেট করে লেটেস্ট ডাটা নিশ্চিত করা
      queryClient.invalidateQueries({ queryKey: ['userCoinBalance'] });
      
      // যদি আপনার কোনো 'transactions' হিস্ট্রির ফেচ লজিক থাকে, তবে সেটাও ইনভ্যালিডেট করে দিতে পারেন:
      // queryClient.invalidateQueries({ queryKey: ['userTransactions'] }); 
    },
  });

  return {
    coinBalance,
    isCoinsLoading,
    coinsError,
    refetchBalance,
    marketplaceItems,
    isItemsLoading,
    itemsError,
    refetchItems,
    purchaseMutation
  };
};
