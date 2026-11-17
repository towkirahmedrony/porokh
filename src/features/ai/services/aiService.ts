import apiClient from '@/shared/lib/apiClient';
import { Subject } from '../types/ai';
import type { AppLanguage } from '@/shared/i18n/messages';

/**
 * আপনার content.routes.ts অনুযায়ী সাবজেক্ট নিয়ে আসা।
 * পাথ: /content/taxonomy/subjects
 */
export const fetchAiSubjects = async (): Promise<Subject[]> => {
  const response = await apiClient.get('/content/taxonomy/subjects'); 
  return response.data.data; // content.controller এ data ফিল্ডে রেজাল্ট পাঠানো হয়
};

/**
 * এআই চ্যাট এন্ডপয়েন্ট
 * পাথ: /ai/chat
 */
export const sendChatMessage = async (payload: {
  message: string;
  subjectId: string;
  sessionId?: string | null;
  lang?: AppLanguage;
}) => {
  const response = await apiClient.post('/ai/chat', payload);
  return response.data.data;
};
