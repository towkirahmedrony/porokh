import type { AppLanguage, AppMessageKey } from './messages';

/**
 * A user-facing failure that carries a translation key instead of prose, so the
 * UI can render it in whichever language is active at display time.
 */
export class MessageError extends Error {
  readonly key: AppMessageKey;

  constructor(key: AppMessageKey) {
    super(key);
    this.key = key;
    this.name = 'MessageError';
  }
}


export type LocalizedText = {
  bn?: string | null;
  en?: string | null;
};

/** Pick the requested language, then the other language, without throwing. */
export function pickLang(
  lang: AppLanguage | string | null | undefined,
  bn?: string | null,
  en?: string | null,
): string {
  const preferred = lang === 'en' ? en : bn;
  const fallback = lang === 'en' ? bn : en;
  return preferred?.trim() || fallback?.trim() || '';
}

/** Resolve a bilingual value while preserving the database object shape. */
export function getLocalized(
  value: LocalizedText | null | undefined,
  lang: AppLanguage | string | null | undefined,
): string {
  return pickLang(lang, value?.bn, value?.en);
}

export const asLocalizedText = (
  bn?: string | null,
  en?: string | null,
): LocalizedText => ({ bn, en });
