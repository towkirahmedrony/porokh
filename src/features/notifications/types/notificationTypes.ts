export interface NotificationRead {
  is_read: boolean;
  is_clicked: boolean;
}

export interface DBNotificationItem {
  id: string;
  title_en: string;
  title_bn: string | null;
  body_en: string;
  body_bn: string | null;
  type: string;
  event_code?: string | null;
  priority?: string | null;
  image_url: string | null;
  action_link: string | null;
  created_at: string;
  notification_reads?: NotificationRead[];
}
