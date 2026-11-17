const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/;

export const isGroupUuid = (value: string | null | undefined): boolean =>
  Boolean(value && UUID_PATTERN.test(value));

export const isValidGroupSlug = (value: string | null | undefined): boolean =>
  Boolean(value && SLUG_PATTERN.test(value.trim().toLowerCase()));

export const suggestGroupSlug = (name: string): string =>
  name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');

export const groupPath = (slugOrId: string, tab?: string): string =>
  `/groups/${slugOrId}${tab ? `?tab=${tab}` : ''}`;

export const groupShareUrl = (slugOrId: string, code?: string | null): string => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = `${origin}/groups/${slugOrId}`;
  return code ? `${url}?code=${encodeURIComponent(code.trim().toUpperCase())}` : url;
};
