import apiClient from '@/shared/lib/apiClient';

// Importing types based on project structure.
import type { PublicProfile } from '../types/publicProfile';
import type { UserProfileData } from '../types/profile';

// ব্যাকএন্ডের রেসপন্সের সাথে মিলিয়ে ইন্টারফেস আপডেট করা হলো
export interface PublicProfileResponse extends Omit<PublicProfile, 'badges' | 'activity'> {
  badges?: any; // Replace with actual Badge type
  activity?: any; // Replace with actual Activity type
}

export const getPublicProfileData = async (targetId: string, currentUserId?: string): Promise<PublicProfileResponse> => {
  try {
    const headers: Record<string, string> = {};
    
    if (currentUserId) {
      headers['x-user-id'] = currentUserId;
    }

    // ব্যাকএন্ড থেকে আসা ডেটার টাইপ আপডেট করা হয়েছে
    const response = await apiClient.get<{ success: boolean; message: string; data: PublicProfileResponse }>(
      `/profiles/public/${targetId}`, 
      { headers }
    );

    return response.data?.data;
  } catch (error: unknown) {
    const err = error as any;
    if (err.response?.status === 404) {
      throw new Error('User not found');
    }
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      throw new Error('timeout');
    }
    
    const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch public profile';
    throw new Error(errorMessage);
  }
};

/**
 * Fetches the current authenticated user's profile from Express Backend.
 * সরাসরি Supabase কল না করে API Client ব্যবহার করা হয়েছে।
 */
export const getCurrentUserProfile = async (): Promise<UserProfileData> => {
  try {
    // আপনার ব্যাকএন্ডের /me রাউটে কল করা হচ্ছে
    const response = await apiClient.get<{ success: boolean; message: string; data: UserProfileData }>(
      '/profiles/me'
    );

    if (!response.data?.success || !response.data?.data) {
      throw new Error('Profile data not found');
    }

    return response.data.data;
  } catch (error: unknown) {
    const err = error as any;
    const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch user profile';
    throw new Error(errorMessage);
  }
};
