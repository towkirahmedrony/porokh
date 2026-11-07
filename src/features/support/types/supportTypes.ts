export const SUPPORT_CATEGORIES = [
  'general',
  'bug',
  'question',
  'exam',
  'account',
  'payment',
  'feature',
  'other',
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export const SUPPORT_STATUSES = [
  'open',
  'in_progress',
  'awaiting_student',
  'resolved',
  'closed',
] as const;

export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export type SupportPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface SupportAttachment {
  url: string;
  name: string;
  mime_type: string;
  size: number;
}

export interface SupportTicket {
  id: string;
  ticket_ref: string;
  user_id: string;
  category: SupportCategory;
  subject: string;
  status: SupportStatus;
  priority: SupportPriority;
  assigned_to: string | null;
  context_question_id: string | null;
  context_exam_id: string | null;
  context_screen: string | null;
  last_message_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  author_id: string;
  author_role: 'student' | 'staff';
  body: string;
  attachments: SupportAttachment[];
  created_at: string;
  author?: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

export interface SupportTicketDetail {
  ticket: SupportTicket;
  messages: SupportMessage[];
}

export interface SupportTicketList {
  items: SupportTicket[];
  total: number;
  limit: number;
  offset: number;
}

export interface SupportTicketDraft {
  category: SupportCategory;
  subject: string;
  description: string;
  context?: {
    question_id?: string | null;
    exam_id?: string | null;
    screen?: string | null;
  };
  attachments?: Array<{
    file_name: string;
    mime_type: string;
    data_url: string;
  }>;
}

export interface SupportListParams {
  status?: SupportStatus;
  category?: SupportCategory;
  search?: string;
  limit?: number;
  offset?: number;
}
