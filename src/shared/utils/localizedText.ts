import { localize, type Lang } from './questionFormat';

/**
 * Resolve a database text value for display: bilingual objects, JSON strings
 * and plain prose all end as one sentence. A value that still looks like an
 * object is dropped rather than printed, so `{"bn":..,"en":..}` can never leak
 * into an explanation.
 */
export const resolveDisplayText = (value: unknown, language: Lang): string => {
  if (value === null || value === undefined) return '';

  const resolved = localize(value, language).trim();

  if (!resolved) return '';
  if (resolved === '[object Object]') return '';
  if (resolved.startsWith('{')) return '';

  return resolved;
};
