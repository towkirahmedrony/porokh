import { Database } from '@/shared/types/supabase';

type QuestionRow = Database['public']['Tables']['questions']['Row'];

export interface Option {
  id: string;
  text: string;
  text_bn?: string;
  text_en?: string | null;
  image_url?: string | null;
  isCorrect?: boolean;
  is_correct?: boolean;
}

export interface MediaLibrary {
  file_url: string;
}

export interface LocalizedQuestionBody {
  text?: string | null;
  text_bn?: string | null;
  text_en?: string | null;
  image_url?: string | null;
}

export interface LocalizedExplanation {
  bn?: string | null;
  en?: string | null;
}

export interface Comprehension {
  id: string;
  body: string; 
  image_url?: string;
  media_library?: MediaLibrary; 
}

export interface Question extends Omit<QuestionRow, 'options' | 'body' | 'exam_references' | 'explanation'> {
  options: Option[]; 
  comprehension?: Comprehension; 
  image_url?: string; 
  media_library?: MediaLibrary; 
  marks?: number;     
  board_ref?: string | null;
  text?: string;
  text_bn?: string; 
  text_en?: string | null;
  body?: LocalizedQuestionBody | string | null;
  exam_references?: unknown; 
  explanation?: LocalizedExplanation | string | null;
}

export interface ExamState {
  answers: Record<string, string>; 
  timeRemaining: number;
  isSubmitted: boolean;
}

export interface ExamResultData {
  exam_id: string;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  timeSpentSeconds: number;
  questions: Question[];
  userAnswers: Record<string, string>; 
  totalScore: number;
}

export interface QuestionPayload {
  id: string;
  [key: string]: unknown;
}

export interface ExamResultDetail {
  question_id: string;
  selected_option?: string | number | null;
  selected_option_text?: string | null;
  correct_option_id?: string | null;
  correct_option_text?: string | null;
  is_correct?: boolean | null;
  marks_awarded?: number;
  status?: 'correct' | 'wrong' | 'skipped' | 'question_not_found' | string;
}

export interface ExamResultPayload {
  id: string;
  exam_id?: string;
  score: number;
  total_marks: number;
  correct_count: number;
  wrong_count: number;
  skipped_count: number;
  time_taken: number;
  details_json: {
    questions?: Question[];
    details?: ExamResultDetail[];
    userAnswers?: Record<string, string>;
    answers?: Record<string, string>;
    bookmarked_ids?: string[];
    correct_answers_revealed?: boolean;
  } | null;
}

export interface ExamConfig {
  questionCount: number;
  duration: number; 
  negativeMarking: boolean;
}

export interface QuestionOption {
  id: string;
  isCorrect: boolean;
  text?: string;
  text_bn?: string;
  text_en?: string;
  [key: string]: unknown;
}

export interface ExamQuestion extends Omit<Question, 'options'> {
  options: QuestionOption[];
  [key: string]: unknown; 
}

export interface LeaderboardEntry {
  id: string;
  user_id: string;
  user_name: string;
  score: number;
  total_marks: number;
  time_taken: number;
  device_type: string;
}

export interface ProgressEntry {
  id: string;
  user_id: string;
  user_name?: string | null;
  current_question_index?: number | null;
  time_remaining?: number | null;
  last_updated_at?: string | null;
}

export interface ExamDetails {
  id: string;
  title: string;
  subject_id: string;
  category: string;
  exam_type: string;
  total_marks: number;
  pass_mark: number;
  default_negative_marks: number;
  duration_min: number;
  start_time: string | null;
  end_time: string | null;
  result_publish_time?: string | null;
  syllabus_details?: string | null;
  instructions?: string | null;
  show_leaderboard?: boolean;
  is_premium?: boolean;
  is_published?: boolean;
}
