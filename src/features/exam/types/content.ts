import { Database } from '@/shared/types/supabase';

// Supabase থেকে সরাসরি Row টাইপগুলো নেওয়া হচ্ছে
type TopicRow = Database['public']['Tables']['topics']['Row'];
type ChapterRow = Database['public']['Tables']['chapters']['Row'];
type SubjectRow = Database['public']['Tables']['subjects']['Row'];
type ExamPaperRow = Database['public']['Tables']['exam_papers']['Row'];

/**
 * Frontend-specific Topic Interface
 * Database Row-এর সাথে ফ্রন্টএন্ডের জয়েন করা ডাটাগুলো যুক্ত করা হচ্ছে।
 */
export interface Topic extends Omit<TopicRow, 'total_questions'> {
  total_questions?: number | null; 
}

export interface Chapter extends ChapterRow {
  children?: Topic[]; 
}

export interface Subject extends SubjectRow {
  children?: Chapter[]; 
}

// --- Frontend-specific Exam Types ---

export interface BoardExamMetaData {
  board?: string;
  year?: string;
  [key: string]: unknown; // Allow other JSON properties if present
}

export interface BoardExamPaper extends Omit<ExamPaperRow, 'meta_data'> {
  meta_data: BoardExamMetaData | null;
  // Frontend-specific UI states can be added here
}

// --- Challenge Types ---

/**
 * Public challenge option. The backend never sends `isCorrect` (or any other
 * answer-key field); grading happens server-side only.
 */
export interface ChallengeOption {
  readonly id: string;
  readonly text: string;
  readonly image_url?: string | null;
}

export interface ChallengeQuestion {
  readonly id: string;
  readonly text: string;
  readonly type?: string | null;
  readonly difficulty_level?: string | null;
  readonly image_url?: string | null;
  readonly options: readonly ChallengeOption[];
}

export interface OpponentData {
  readonly id?: string | null;
  readonly name: string;
  readonly score: number;
  readonly time_taken: number;
}

export interface ChallengeSelfData {
  readonly score: number;
  readonly time_taken: number;
}

/** Authoritative result returned by the submission endpoint. */
export interface ChallengeResult {
  readonly score: number;
  readonly total: number;
  readonly time_taken: number;
  readonly correct_count?: number;
  readonly wrong_count?: number;
  readonly submitted_at?: string | null;
  readonly status?: string | null;
  readonly winner_id?: string | null;
  readonly duplicate?: boolean;
}

export interface ChallengeData {
  readonly id?: string;
  readonly questions: readonly ChallengeQuestion[];
  readonly opponent: OpponentData;
  readonly you?: ChallengeSelfData;
  readonly status?: string;
  readonly submitted?: boolean;
  readonly result?: ChallengeResult | null;
  readonly start_time?: string | null;
  readonly end_time?: string | null;
  readonly server_time?: string | null;
}

/** Submission accepts selected option ids only — never a score or duration. */
export interface ChallengeSubmitPayload {
  readonly answers: Record<string, string>;
}
