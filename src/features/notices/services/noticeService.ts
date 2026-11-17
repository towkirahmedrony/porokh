import { apiClient } from '@/shared/lib/apiClient';
import {
  NoticeItem,
  NoticeListResult,
  NoticePriority,
} from '../types/noticeTypes';

interface ApiEnvelope<T> {
  data?: T;
}

const unwrap = <T>(payload: ApiEnvelope<T> | T): T => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as ApiEnvelope<T>).data as T;
  }

  return payload as T;
};

export const fetchNotices = async (params?: {
  limit?: number;
  offset?: number;
  priority?: NoticePriority;
}): Promise<NoticeListResult> => {
  const response = await apiClient.get<ApiEnvelope<NoticeListResult>>('/notices', {
    params,
  });

  return (
    unwrap(response.data) ?? { items: [], total: 0, limit: 50, offset: 0 }
  );
};

export const fetchNotice = async (noticeId: string): Promise<NoticeItem> => {
  const response = await apiClient.get<ApiEnvelope<NoticeItem>>(
    `/notices/${noticeId}`
  );

  return unwrap(response.data);
};

export const fetchUrgentNotice = async (): Promise<NoticeItem | null> => {
  const response = await apiClient.get<ApiEnvelope<NoticeItem | null>>(
    '/notices/urgent'
  );

  return unwrap(response.data) ?? null;
};

export const fetchUnreadNoticeCount = async (): Promise<number> => {
  const response = await apiClient.get<ApiEnvelope<{ count?: number }>>(
    '/notices/unread-count'
  );

  return unwrap(response.data)?.count ?? 0;
};

export const markNoticeRead = async (noticeId: string): Promise<void> => {
  await apiClient.post(`/notices/${noticeId}/read`);
};

export const dismissNotice = async (noticeId: string): Promise<void> => {
  await apiClient.post(`/notices/${noticeId}/dismiss`);
};
