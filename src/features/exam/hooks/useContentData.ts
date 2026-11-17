import { useQuery } from '@tanstack/react-query';
import apiClient from '@/shared/lib/apiClient';
import { Subject } from '../types/content'; // আপনার টাইপ ফাইল

export const useCurriculumTree = () => {
  return useQuery({
    queryKey: ['curriculum-tree'],
    queryFn: async (): Promise<Subject[]> => {
      const response = await apiClient.get('/content/curriculum');
      // ব্যাকএন্ড থেকে আসা ট্রি স্ট্রাকচার রিটার্ন করা হচ্ছে
      return response.data.data;
    },
    staleTime: 1000 * 60 * 60, // ১ ঘণ্টা ক্যাশে থাকবে (যেহেতু সিলেবাস বারবার পরিবর্তন হয় না)
  });
};
