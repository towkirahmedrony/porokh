export interface NamecardNameSources {
  fullName?: unknown;
  username?: unknown;
  metadataName?: unknown;
}

export const normalizeDisplayName = (value: unknown): string | null => {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

/**
 * Homepage namecard identity, most authoritative source first:
 * profiles.full_name -> profiles.username -> auth metadata name.
 */
export function resolveNamecardName({
  fullName,
  username,
  metadataName,
}: NamecardNameSources): string | null {
  return (
    normalizeDisplayName(fullName) ||
    normalizeDisplayName(username) ||
    normalizeDisplayName(metadataName)
  );
}

/**
 * The skeleton is only justified while *no* name is known yet. Once any name is
 * available (for example the name carried by the auth session) the card renders
 * that name and lets the profile row refine it in place, so the user never sees
 * the text flip back to a placeholder while data refreshes.
 */
export function shouldShowNameSkeleton(
  name: string | null,
  isLoading: boolean
): boolean {
  return isLoading && !name;
}
