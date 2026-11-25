import type { AppMessageKey } from '@/shared/i18n/messages';
import {
  SUPPORT_CATEGORIES,
  SUPPORT_STATUSES,
  type SupportCategory,
  type SupportStatus,
} from '../types/supportTypes';

export const MAX_SUPPORT_ATTACHMENTS = 3;
export const MAX_SUPPORT_ATTACHMENT_BYTES = 2 * 1024 * 1024;
export const SUPPORT_ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const CATEGORY_LABEL_KEYS: Record<SupportCategory, AppMessageKey> = {
  general: 'support.catGeneral',
  bug: 'support.catBug',
  question: 'support.catQuestion',
  exam: 'support.catExam',
  account: 'support.catAccount',
  payment: 'support.catPayment',
  feature: 'support.catFeature',
  other: 'support.catOther',
};

export const STATUS_LABEL_KEYS: Record<SupportStatus, AppMessageKey> = {
  open: 'support.statusOpen',
  in_progress: 'support.statusInProgress',
  awaiting_student: 'support.statusAwaiting',
  resolved: 'support.statusResolved',
  closed: 'support.statusClosed',
};

/**
 * The student sees three buckets, not five database statuses. Old rows keep
 * their stored status; this maps them onto the same two buckets.
 */
export type SupportFilter = 'all' | 'active' | 'resolved';

export const SUPPORT_FILTERS: Array<{
  value: SupportFilter;
  labelKey: AppMessageKey;
  statuses?: SupportStatus[];
}> = [
  { value: 'all', labelKey: 'support.filterAll' },
  {
    value: 'active',
    labelKey: 'support.filterAwaiting',
    statuses: ['open', 'in_progress', 'awaiting_student'],
  },
  {
    value: 'resolved',
    labelKey: 'support.filterResolved',
    statuses: ['resolved', 'closed'],
  },
];

/** `closed` counts as resolved everywhere the student sees a label. */
export const statusGroup = (status: SupportStatus): 'active' | 'resolved' =>
  status === 'resolved' || status === 'closed' ? 'resolved' : 'active';

export const STATUS_GROUP_LABEL_KEYS: Record<'active' | 'resolved', AppMessageKey> = {
  active: 'support.filterAwaiting',
  resolved: 'support.filterResolved',
};

export const isSupportCategory = (value: unknown): value is SupportCategory =>
  typeof value === 'string' &&
  (SUPPORT_CATEGORIES as readonly string[]).includes(value);

export const isSupportStatus = (value: unknown): value is SupportStatus =>
  typeof value === 'string' &&
  (SUPPORT_STATUSES as readonly string[]).includes(value);

/** A student may keep the conversation going until the ticket is closed. */
export const canStudentReply = (status: SupportStatus): boolean => status !== 'closed';

export const canReopen = (status: SupportStatus): boolean => status === 'resolved';

export const isActiveStatus = (status: SupportStatus): boolean =>
  status === 'open' || status === 'in_progress' || status === 'awaiting_student';

/**
 * Client-side pre-check before a screenshot is read into memory. The server
 * repeats every check, so this is only fast feedback for the student.
 */
export const validateAttachmentFile = (
  file: { type: string; size: number },
  existingCount: number
): 'support.errTooMany' | 'support.errFileType' | 'support.errFileSize' | null => {
  if (existingCount >= MAX_SUPPORT_ATTACHMENTS) return 'support.errTooMany';
  if (!SUPPORT_ATTACHMENT_TYPES.includes(file.type)) return 'support.errFileType';
  if (file.size <= 0) return 'support.errFileType';
  if (file.size > MAX_SUPPORT_ATTACHMENT_BYTES) return 'support.errFileSize';
  return null;
};

/** `2026-11-07T10:00:00Z` -> localized short date and time. */
export const formatSupportDate = (iso: string, language: string): string => {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return '';

  try {
    return new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toISOString().slice(0, 16).replace('T', ' ');
  }
};

/** Subject/description limits mirror the API so the form fails fast. */
export const validateTicketDraft = (draft: {
  category: string;
  subject: string;
  description: string;
}): AppMessageKey | null => {
  const subject = draft.subject.trim();
  const description = draft.description.trim();

  if (!isSupportCategory(draft.category)) return 'support.errCategory';
  if (subject.length < 5 || subject.length > 140) return 'support.errSubject';
  if (description.length < 10) return 'support.errDescription';
  if (description.length > 5000) return 'support.errDescriptionLong';
  return null;
};

export const buildSupportTicketPath = (ticketId: string): string =>
  `/support/${ticketId}`;

export const buildNewTicketPath = (input: {
  category?: string | null;
  questionId?: string | null;
  examId?: string | null;
  screen?: string | null;
}): string => {
  const params = new URLSearchParams();
  if (input.category) params.set('category', input.category);
  if (input.questionId) params.set('question_id', input.questionId);
  if (input.examId) params.set('exam_id', input.examId);
  if (input.screen) params.set('screen', input.screen);

  const query = params.toString();
  return query ? `/support/new?${query}` : '/support/new';
};
