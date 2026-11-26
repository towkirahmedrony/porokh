export interface ProgressUser {
  name: string | null;
  avatar_url: string | null;
  class_label: string | null;
  total_xp: number;
}

export interface ProgressLevel {
  id: number;
  name_bn: string;
  name_en: string;
  min_xp: number;
  max_xp: number | null;
  next_min_xp: number | null;
}

export interface ProgressSummary {
  accuracy_pct: number | null;
  average_score_pct: number | null;
  exams_taken: number;
  practice_sessions: number;
  streak_days: number;
  longest_streak_days: number;
  correct: number;
  wrong: number;
  skipped: number;
  responses: number;
}

export interface ProgressActivityDay {
  date: string;
  count: number;
}

export interface ProgressTrendPoint {
  date: string;
  iso: string;
  score_pct: number;
  score: number;
  total_marks: number;
}

export interface ProgressChapterStat {
  chapter_id: string | null;
  name_bn: string | null;
  name_en: string | null;
  responses: number;
  correct: number;
  wrong: number;
  skipped: number;
  accuracy_pct: number | null;
}

export interface ProgressSubjectStat {
  subject_id: string;
  name_bn: string;
  name_en: string | null;
  attempts: number;
  responses: number;
  correct: number;
  wrong: number;
  skipped: number;
  accuracy_pct: number | null;
  chapters: ProgressChapterStat[];
}

export interface ProgressWeakTopic {
  topic_id: string;
  topic_name_bn: string;
  topic_name_en: string | null;
  chapter_id: string | null;
  chapter_name_bn: string | null;
  chapter_name_en: string | null;
  subject_id: string;
  subject_name_bn: string;
  subject_name_en: string | null;
  responses: number;
  wrong: number;
  skipped: number;
  error_rate_pct: number;
}

export type ProgressMentorKind = 'weakest_topic' | 'weakest_subject' | 'no_attempts';

export interface ProgressMentor {
  kind: ProgressMentorKind;
  topic_id: string | null;
  topic_name_bn: string | null;
  chapter_name_bn: string | null;
  subject_id: string | null;
  subject_name_bn: string | null;
  accuracy_pct: number | null;
  error_rate_pct: number | null;
  skipped_heavy: boolean;
  href: string;
}

export interface ProgressDashboardResponse {
  user: ProgressUser;
  level: ProgressLevel | null;
  summary: ProgressSummary;
  activity: {
    window_days: number;
    days: ProgressActivityDay[];
  };
  performance: ProgressTrendPoint[];
  subjects: ProgressSubjectStat[];
  weaknesses: ProgressWeakTopic[];
  mentor: ProgressMentor;
  mistakes: {
    available: number;
  };
}
