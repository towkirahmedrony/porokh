export interface HomeGridProfile {
  studyGoal?: string | null;
  hscBatch?: string | null;
  group?: string | null;
}

/**
 * Keys written by the Home-grid editor. `class_level`/`class_levels` are the
 * older names for the same thing and are still read, so rules authored before
 * the batch rename keep matching; unknown keys (for example the banner text
 * overrides stored in `home_banners.target_rules`) are ignored.
 */
const RULE_KEYS: Array<[string, keyof HomeGridProfile]> = [
  ['study_goal', 'studyGoal'],
  ['hsc_batch', 'hscBatch'],
  ['class_level', 'hscBatch'],
  ['class_levels', 'hscBatch'],
  ['group', 'group'],
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeValue = (value: string): string => value.trim().toLowerCase();

/**
 * "HSC 26", "hsc-26" and "2026" all name the 2026 batch, so a rule written
 * against the old class label still matches the student's batch.
 */
export const normalizeBatchRuleValue = (value: string): string => {
  const digits = value.replace(/\D/g, '');

  if (digits.length === 2) return `20${digits}`;
  if (digits.length === 4) return digits;

  return normalizeValue(value);
};

const normalizeRuleValues = (value: unknown): string[] => {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];

  return raw.filter((entry): entry is string => typeof entry === 'string');
};

/**
 * Empty rules mean "everyone". A rule that names values only matches a profile
 * that has a value; a user who skipped onboarding step 2 therefore sees only
 * the cards without rules.
 */
export const matchesHomeGridTargetRules = (
  rules: unknown,
  profile: HomeGridProfile
): boolean => {
  if (!isRecord(rules)) return true;

  for (const [ruleKey, profileKey] of RULE_KEYS) {
    const targets = normalizeRuleValues(rules[ruleKey]);

    if (targets.length === 0) continue;
    if (targets.some((target) => normalizeValue(target) === 'all')) continue;

    const compare = profileKey === 'hscBatch' ? normalizeBatchRuleValue : normalizeValue;
    const profileValue = compare(profile[profileKey] ?? '');

    if (!profileValue || !targets.some((target) => compare(target) === profileValue)) {
      return false;
    }
  }

  return true;
};
