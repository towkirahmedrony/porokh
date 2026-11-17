export interface HomeGridProfile {
  studyGoal?: string | null;
  classLevel?: string | null;
  group?: string | null;
}

/**
 * Keys written by the Home-grid editor. Unknown keys (for example the banner
 * text overrides stored in `home_banners.target_rules`) are ignored, so the
 * same matcher can be reused without forcing every table into one schema.
 */
const RULE_KEYS: Array<[string, keyof HomeGridProfile]> = [
  ['study_goal', 'studyGoal'],
  ['class_level', 'classLevel'],
  ['class_levels', 'classLevel'],
  ['group', 'group'],
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeRuleValues = (value: unknown): string[] => {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];

  return raw
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
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
    if (targets.includes('all')) continue;

    const profileValue = (profile[profileKey] ?? '').trim().toLowerCase();

    if (!profileValue || !targets.includes(profileValue)) {
      return false;
    }
  }

  return true;
};
