import type {
  QuestionBankHubPayload,
  QuestionBankHubRow,
  QuestionBankHubSection,
} from '../types/questionBankHub';
import type { QuestionBankTrack } from '../types/questionBank';

/**
 * Pure decisions for the hub screen: which rows the hub itself shows, and where
 * each row goes.
 *
 * The URLs are built here rather than inline in the page so the preset a row
 * sends can be tested against the count the row prints. Every href points at
 * `/question-bank/list` with the same filter keys the list already understood,
 * so a hub link is a normal deep link.
 */

/** Colleges below this count are noise on the hub; they still exist in the full list. */
export const HUB_COLLEGE_MIN_COUNT = 3;
/** College rows the hub prints before its "সব কলেজ" row. */
export const HUB_COLLEGE_LIMIT = 8;
/** University rows the hub prints before its "সব বিশ্ববিদ্যালয়" row. */
export const HUB_UNIVERSITY_LIMIT = 6;
/** Below this count a hand-tagged track gets the "coming soon" line. */
export const HUB_THIN_TRACK_COUNT = 50;

const LIST_PATH = '/question-bank/list';

const listHref = (params: Record<string, string>): string => {
  const search = new URLSearchParams(params).toString();
  return search ? `${LIST_PATH}?${search}` : LIST_PATH;
};

export const hubSubjectHref = (subjectId: string): string =>
  listHref({ level: 'hsc', subject: subjectId });

export const hubInstitutionHref = (institutionId: string): string =>
  listHref({ level: 'hsc', institutionId });

export const hubTrackHref = (track: QuestionBankTrack): string =>
  listHref({ level: 'admission', track });

export const hubAllAdmissionHref = (): string =>
  listHref({ level: 'admission', allTracks: '1' });

export const hubAdmissionSubjectHref = (subjectId: string): string =>
  listHref({ level: 'admission', allTracks: '1', subject: subjectId });

export const hubUniversityHref = (universityId: string): string =>
  listHref({ level: 'admission', allTracks: '1', university: universityId });

export const hubUniversityPageHref = (universityId: string): string =>
  `/question-bank/university/${encodeURIComponent(universityId)}`;

/** The list behind one exam year of one unit of one university. */
export const hubUniversityYearHref = (
  universityId: string,
  unitId: string,
  year: string
): string =>
  listHref({
    level: 'admission',
    allTracks: '1',
    university: universityId,
    ...(unitId ? { unit: unitId } : {}),
    year,
  });

export const hubAllUniversitiesHref = (): string => '/question-bank/universities';

export const hubAllCollegesHref = (): string => '/question-bank/colleges';

/**
 * Search opens the list with the field focused, in the tab the student is on.
 * `view=list` is what tells the list to render rows instead of its subject
 * picker, which is only reached by an unscoped URL.
 */
export const hubSearchHref = (mode: 'hsc' | 'admission'): string =>
  listHref({ level: mode, view: 'list' });

export const findSection = <K extends QuestionBankHubSection['kind']>(
  payload: QuestionBankHubPayload | undefined,
  kind: K
): Extract<QuestionBankHubSection, { kind: K }> | null => {
  const section = payload?.sections.find((item) => item.kind === kind);
  return (section as Extract<QuestionBankHubSection, { kind: K }> | undefined) ?? null;
};

const byCountThenName = (a: QuestionBankHubRow, b: QuestionBankHubRow): number =>
  b.count - a.count || a.labelBn.localeCompare(b.labelBn, 'bn');

/**
 * The college rows the hub prints.
 *
 * The threshold is a product rule, not a data rule: 19 of the 35 colleges with
 * questions hold one or two, and a wall of near-empty rows buries the ones a
 * student is actually looking for. They stay reachable from the full list.
 */
export const hubCollegeRows = (rows: QuestionBankHubRow[]): QuestionBankHubRow[] =>
  rows
    .filter((row) => row.count >= HUB_COLLEGE_MIN_COUNT)
    .sort(byCountThenName)
    .slice(0, HUB_COLLEGE_LIMIT);

/** True when the full college list holds a row the hub did not print. */
export const hasMoreColleges = (rows: QuestionBankHubRow[]): boolean =>
  rows.length > hubCollegeRows(rows).length;

export const hubUniversityRows = (rows: QuestionBankHubRow[]): QuestionBankHubRow[] =>
  [...rows].sort(byCountThenName).slice(0, HUB_UNIVERSITY_LIMIT);

/**
 * Whether a track needs the "more questions soon" line. A hand-tagged track
 * with a handful of questions is honest about it instead of looking empty.
 */
export const isThinTrack = (count: number): boolean =>
  count > 0 && count < HUB_THIN_TRACK_COUNT;
