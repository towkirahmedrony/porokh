import { Building2, HardHat, Stethoscope, type LucideIcon } from 'lucide-react';

import type { AppMessageKey } from '@/shared/i18n/messages';
import type { AdmissionGoal } from '@/shared/lib/academic';

export interface GoalOptionMeta {
  goal: AdmissionGoal;
  icon: LucideIcon;
  labelKey: AppMessageKey;
  hintKey: AppMessageKey;
}

/** Order is the product order: university first, then medical, engineering. */
export const GOAL_OPTIONS: readonly GoalOptionMeta[] = [
  { goal: 'varsity', icon: Building2, labelKey: 'goalGate.varsity', hintKey: 'goalGate.varsityHint' },
  { goal: 'medical', icon: Stethoscope, labelKey: 'goalGate.medical', hintKey: 'goalGate.medicalHint' },
  { goal: 'engineering', icon: HardHat, labelKey: 'goalGate.engineering', hintKey: 'goalGate.engineeringHint' },
];
