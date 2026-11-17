export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

/** Normalize usernames to lowercase ASCII letters, digits, and underscores. */
export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value);
}
