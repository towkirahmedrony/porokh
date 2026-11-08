import { BookOpen, Cpu, HeartPulse, type LucideIcon } from 'lucide-react';
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

export const isModelTrack = (value: string | null | undefined): value is ModelTrack =>
  (MODEL_TRACKS as readonly string[]).includes(value ?? '');

export const getModelTrackConfig = (track: ModelTrack): ModelTrackConfig =>
  MODEL_TRACK_CONFIGS.find((config) => config.value === track) ?? MODEL_TRACK_CONFIGS[0];

export type ModelPaperScope = 'full' | 'subject';

export const modelTrackPath = (track: ModelTrack): string => `/exams/model/${track}`;

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
