import { Building2, FileText, GraduationCap, type LucideIcon } from 'lucide-react';
import type { AppMessageKey } from '@/shared/i18n/messages';

export type ExamType = 'model' | 'board' | 'admission';

export type ExamDatabaseType = 'model_test' | 'board_exam' | 'admission';

export interface ExamTypeConfig<T extends ExamType = ExamType> {
  type: T;
  databaseValue: ExamDatabaseType;
  titleKey: AppMessageKey;
  icon: LucideIcon;
  color: string;
}

export const EXAM_TYPES: { [K in ExamType]: ExamTypeConfig<K> } = {
  model: {
    type: 'model',
    databaseValue: 'model_test',
    titleKey: 'exam.modelTest',
    icon: FileText,
    color: '#2563eb',
  },
  board: {
    type: 'board',
    databaseValue: 'board_exam',
    titleKey: 'exam.boardExam',
    icon: Building2,
    color: '#059669',
  },
  admission: {
    type: 'admission',
    databaseValue: 'admission',
    titleKey: 'nav.admission',
    icon: GraduationCap,
    color: '#7c3aed',
  },
};

export const EXAM_TYPE_LIST = Object.keys(EXAM_TYPES) as ExamType[];

export const EXAM_TAB_TYPES = ['model', 'board'] as const;

export type ExamTabType = (typeof EXAM_TAB_TYPES)[number];

export const EXAM_TAB_CONFIGS = EXAM_TAB_TYPES.map((type) => EXAM_TYPES[type]);

export const isExamType = (value: string | null | undefined): value is ExamType =>
  (EXAM_TYPE_LIST as string[]).includes(value ?? '');

export const isExamTabType = (value: ExamType): value is ExamTabType =>
  (EXAM_TAB_TYPES as readonly ExamType[]).includes(value);

export const examListPath = (type: ExamType): string => `/exams/${type}`;
