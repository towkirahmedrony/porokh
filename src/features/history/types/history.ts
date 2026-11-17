export type TabType = 'history' | 'mistakes' | 'bookmarks';

// Type for localized text supporting multiple languages or plain string
export type LocalizedText = string | { bn?: string; text?: string; [key: string]: unknown } | null | undefined;

// Type for question options
export interface QuestionOption {
  id?: string | number | null;
  text?: string;
  bn?: string;
  text_bn?: string | null;
  text_en?: string | null;
  image_url?: string | null;
  // Multiple variations of the correctness flag based on possible backend/Supabase schemas
  isCorrect?: boolean;
  is_correct?: boolean;
  correct?: boolean;
  answer?: boolean;
  [key: string]: unknown; // Allow extra fields from backend safely
}

export interface ReviewQuestion {
  id: string;
  subject_id?: string | null;
  type?: string | null;
  body?: LocalizedText | Record<string, unknown> | null;
  options?: QuestionOption[] | null;
  explanation?: unknown;
  image_url?: string | null;
  media_library?: { file_url?: string | null } | null;
  [key: string]: unknown;
}

export interface HistorySubject {
  id?: string | null;
  name_en?: string | null;
  name_bn?: string | null;
}

import type { PracticeMode } from '@/features/practice/types/practice';

export interface HistoryItem {
  id: string;
  exam_id?: string | null;
  score: number;
  total_marks: number;
  correct_count?: number | null;
  wrong_count?: number | null;
  skipped_count?: number | null;
  question_count?: number | null;
  exam_sequence?: number | null;
  completion_status?: string | null;
  exam_title?: string | null;
  subject_name_en?: string | null;
  subject_name_bn?: string | null;
  subjects?: HistorySubject[] | null;
  // Date fields matching database schema variations
  taken_at?: string;
  submitted_at?: string;
  created_at?: string;
  status?: string | null;
  practice_mode?: PracticeMode | null;
  source_history_id?: string | null;
  retake_available_count?: number;
  wrong_available_count?: number;
  details_json?: { 
    exam_title?: string; 
    [key: string]: unknown;
  } | null;
}

/** Wrong and skipped answers are both mistakes; the backend labels each one. */
export type MistakeStatus = 'wrong' | 'skipped';

export interface MistakeItem {
  id: string;
  detail_id?: string | null;
  selected_option: string | null;
  question_id: string;
  status?: MistakeStatus | null;
  occurred_at?: string | null;
  questions: ReviewQuestion | null;
}

export interface BookmarkItem {
  id: string;
  note?: string | null;
  question_id?: string | null;
  created_at?: string | null;
  questions: ReviewQuestion | null;
}
