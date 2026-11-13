import {
  BookOpen,
  Cpu,
  GraduationCap,
  HeartPulse,
  type LucideIcon,
} from 'lucide-react';
import type { AppMessageKey } from '@/shared/i18n/messages';

export const MODEL_TRACKS = ['hsc', 'medical', 'engineering'] as const;

export type ModelTrack = (typeof MODEL_TRACKS)[number];

export const DEFAULT_MODEL_TRACK: ModelTrack = 'hsc';

export interface ModelTrackConfig {
  value: ModelTrack;
  labelKey: AppMessageKey;
  descriptionKey: AppMessageKey;
  icon: LucideIcon;
  accentClass: string;
}

export const MODEL_TRACK_CONFIGS: ModelTrackConfig[] = [
  {
    value: 'hsc',
    labelKey: 'exam.track.hsc',
    descriptionKey: 'exam.track.hscDesc',
    icon: BookOpen,
    accentClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
  },
  {
    value: 'medical',
    labelKey: 'exam.track.medical',
    descriptionKey: 'exam.track.medicalDesc',
    icon: HeartPulse,
    accentClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  },
  {
    value: 'engineering',
    labelKey: 'exam.track.engineering',
    descriptionKey: 'exam.track.engineeringDesc',
    icon: Cpu,
    accentClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-300',
  },
];

/**
 * Categories shown on the top-level Model Test screen.
 *
 * University admission content is owned by the admission hub rather than the
 * subject-wise model-paper tables, so it deliberately stays out of
 * `MODEL_TRACKS` and its summary service. It is still a first-class entry
 * point here and routes to the database-backed university → unit → paper flow.
 */
export type ModelCategory = ModelTrack | 'varsity';

export type ModelCategoryConfig = Omit<ModelTrackConfig, 'value'> & {
  value: ModelCategory;
};

export const MODEL_CATEGORY_CONFIGS: ModelCategoryConfig[] = [
  ...MODEL_TRACK_CONFIGS,
  {
    value: 'varsity',
    labelKey: 'exam.track.varsity',
    descriptionKey: 'exam.track.varsityDesc',
    icon: GraduationCap,
    accentClass: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
  },
];

export const isModelTrack = (value: string | null | undefined): value is ModelTrack =>
  (MODEL_TRACKS as readonly string[]).includes(value ?? '');

export const getModelTrackConfig = (track: ModelTrack): ModelTrackConfig =>
  MODEL_TRACK_CONFIGS.find((config) => config.value === track) ?? MODEL_TRACK_CONFIGS[0];

export type ModelPaperScope = 'full' | 'subject';

export const modelTrackPath = (track: ModelTrack): string => `/exams/model/${track}`;

export const modelCategoryPath = (category: ModelCategory): string =>
  category === 'varsity' ? '/exams/model/varsity' : modelTrackPath(category);

export const modelSubjectPath = (track: ModelTrack, subjectId: string): string =>
  `/exams/model/${track}/${encodeURIComponent(subjectId)}`;

export const SUBJECT_ACCENT_CLASSES = [
  'bg-rose-500/10 text-rose-600 dark:text-rose-300',
  'bg-blue-500/10 text-blue-600 dark:text-blue-300',
  'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  'bg-violet-500/10 text-violet-600 dark:text-violet-300',
  'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300',
] as const;

export const subjectAccentClass = (index: number): string =>
  SUBJECT_ACCENT_CLASSES[index % SUBJECT_ACCENT_CLASSES.length];
