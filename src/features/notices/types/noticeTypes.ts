export type NoticePriority = 'normal' | 'important' | 'urgent';

export interface NoticeItem {
  id: string;
  title_bn: string;
  title_en: string | null;
  body_bn: string;
  body_en: string | null;
  image_url: string | null;
  attachment_url: string | null;
  action_link: string | null;
  priority: NoticePriority;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
  is_read: boolean;
  is_dismissed: boolean;
  read_at?: string | null;
}

export interface NoticeListResult {
  items: NoticeItem[];
  total: number;
  limit: number;
  offset: number;
}

export const noticeTitle = (notice: NoticeItem, language: 'bn' | 'en'): string => {
  if (language === 'en') return notice.title_en?.trim() || notice.title_bn;
  return notice.title_bn;
};

export const noticeBody = (notice: NoticeItem, language: 'bn' | 'en'): string => {
  if (language === 'en') return notice.body_en?.trim() || notice.body_bn;
  return notice.body_bn;
};
