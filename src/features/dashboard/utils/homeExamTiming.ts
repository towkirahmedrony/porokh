/**
 * Timing rules for the personalised Home exam sections.
 *
 * The database filters out papers that have already ended, but the screen stays
 * open while a countdown runs. Everything here is pure so the cards can be
 * re-classified against the shared ticker instead of refetching.
 */

export type HomeExamTiming = 'live' | 'upcoming' | 'ended';

export interface HomeExamWindow {
  start_time: string | null;
  end_time: string | null;
}

const parseTime = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

/**
 * A paper is only live or upcoming when both ends of its window are known.
 * Anything missing a window cannot be placed on the timeline, so it is dropped
 * rather than mislabelled.
 */
export const getHomeExamTiming = (
  paper: HomeExamWindow,
  now: number
): HomeExamTiming => {
  const start = parseTime(paper.start_time);
  const end = parseTime(paper.end_time);

  if (start === null || end === null) return 'ended';
  if (now > end) return 'ended';
  if (now < start) return 'upcoming';

  return 'live';
};

export const splitHomeExams = <
  T extends HomeExamWindow & { id: string },
>(
  papers: readonly T[],
  now: number
): { live: T[]; upcoming: T[] } => {
  const live: T[] = [];
  const upcoming: T[] = [];

  for (const paper of papers) {
    const timing = getHomeExamTiming(paper, now);
    if (timing === 'live') live.push(paper);
    else if (timing === 'upcoming') upcoming.push(paper);
  }

  live.sort(
    (a, b) => (parseTime(a.end_time) ?? 0) - (parseTime(b.end_time) ?? 0)
  );
  upcoming.sort(
    (a, b) => (parseTime(a.start_time) ?? 0) - (parseTime(b.start_time) ?? 0)
  );

  return { live, upcoming };
};

/**
 * `HH:MM:SS`, clamped at zero. Hours are not wrapped at 24 so a paper three days
 * away reads `72:10:00` rather than looking imminent.
 */
export const formatCountdown = (
  targetIso: string | null | undefined,
  now: number
): string => {
  const target = parseTime(targetIso);
  if (target === null) return '';

  const totalSeconds = Math.max(0, Math.floor((target - now) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
};
