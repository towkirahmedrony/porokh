import apiClient from '@/shared/lib/apiClient';
import { ProgressDashboardResponse } from '../types/progress';

export const fetchProgressDashboardData = async (): Promise<ProgressDashboardResponse> => {
  // apiClient-এ base URL সেট করা থাকায় এখানে শুধু /progress/dashboard দেওয়া হলো
  const response = await apiClient.get('/progress/dashboard');
  
  return response.data.data; 
};
