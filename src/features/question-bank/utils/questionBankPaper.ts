import { localizeDigits, type AppLanguage } from '@/shared/i18n/messages';

/**
 * One exam paper, as the bank stores it: a year plus the shift or set it was
 * sat in. A year on its own is still a paper when the source only knew the
 * year, so the three parts travel as one key through the URL and the listing.
 */
export interface QuestionBankPaper {
  /** The key the listing understands, e.g. `2025-26|shift-1|` or `2018-19`. */
  key: string;
  year: string;
  shift: string | null;
  paperSet: string | null;
  count: number;
}

const SEPARATOR = '|';

/** A paper key: "2025-26" for a plain year, "2025-26|shift-1|" for one shift. */
export const paperKey = (
  year: string,
  shift: string | null,
  paperSet: string | null
): string => (shift || paperSet ? `${year}${SEPARATOR}${shift ?? ''}${SEPARATOR}${paperSet ?? ''}` : year);

export const parsePaperKey = (
  key: string
): { year: string; shift: string | null; paperSet: string | null } => {
  const [year = '', shift = '', paperSet = ''] = key.split(SEPARATOR);
  return {
    year,
    shift: shift.trim() ? shift : null,
    paperSet: paperSet.trim() ? paperSet : null,
  };
};

/** True when the value names one paper instead of a whole year. */
export const isPaperKey = (key: string): boolean => key.includes(SEPARATOR);

/**
 * The stored forms are "shift-1", "Set-3" and the occasional "SET B EVEN".
 * Numbers follow the app language; the word itself is translated.
 */
export const formatPaperPart = (value: string, language: AppLanguage): string => {
  const text = value.trim();
  if (!text) return '';

  const shift = /^shift\b[^0-9]*([0-9]+)$/i.exec(text);
  if (shift) {
    return language === 'bn'
      ? `শিফট ${localizeDigits(shift[1], language)}`
      : `Shift ${shift[1]}`;
  }

  const set = /^set\b[\s_-]*([0-9A-Za-z]+)$/i.exec(text);
  if (set) {
    return language === 'bn'
      ? `সেট ${localizeDigits(set[1], language)}`
      : `Set ${set[1]}`;
  }

  return localizeDigits(text, language);
};

export const paperLabel = (
  paper: Pick<QuestionBankPaper, 'year' | 'shift' | 'paperSet'>,
  language: AppLanguage
): string => {
  const year = localizeDigits(paper.year, language);
  const parts = [paper.shift, paper.paperSet]
    .filter((part): part is string => Boolean(part))
    .map((part) => formatPaperPart(part, language))
    .filter(Boolean);

  return parts.length > 0 ? `${year} (${parts.join(' · ')})` : year;
};
