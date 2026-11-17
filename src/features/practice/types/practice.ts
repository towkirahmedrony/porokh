import type { Question } from '@/features/exam/types/exam';

export type PracticeMode = 'retake' | 'wrong_from_history' | 'wrong_global';

export type PracticeEmptyReason = 'empty' | 'confirm_partial' | 'confirm_reduced';

export interface PracticeAttempt {
  id: string;
  exam_id: string | null;
  kind: string;
  status: string;
  started_at: string | null;
  deadline_at: string | null;
  submitted_at: string | null;
  server_time: string;
  seconds_remaining: number | null;
  answers_draft: Record<string, string> | null;
  current_question_index: number;
  question_ids: string[];
  practice_mode: PracticeMode | null;
  source_history_id: string | null;
}

export interface PracticeStartResult {
  started: boolean;
  reason?: PracticeEmptyReason;
  mode: PracticeMode;
  source_history_id: string | null;
  available_count: number;
  unavailable_count: number;
  total_count: number;
  requested_count?: number;
  resumed?: boolean;
  attempt?: PracticeAttempt;
}

export interface MistakePool {
  available_count: number;
}

export interface AttemptQuestionOption {
  id: string;
  text_bn?: string | null;
  text_en?: string | null;
  image_url?: string | null;
}

export interface AttemptQuestion {
  id: string;
  body?: {
    text_bn?: string | null;
    text_en?: string | null;
    image_url?: string | null;
  } | null;
  options?: AttemptQuestionOption[] | null;
  explanation?: unknown;
  [key: string]: unknown;
}

export interface AttemptQuestionsResponse {
  attempt_id: string;
  exam_id: string | null;
  started_at: string | null;
  deadline_at: string | null;
  server_time: string;
  questions: Question[];
}

export interface PracticeAnswerReveal {
  is_correct: boolean;
  correct_option: {
    id: string;
    text_bn?: string | null;
    text_en?: string | null;
    image_url?: string | null;
  } | null;
  explanation: {
    bn: string;
    en: string;
  } | null;
}
