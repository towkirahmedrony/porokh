import type { BattleState } from '../types';

const FINALIZE_GRACE_MS = 2 * 60 * 1000;

const toEpoch = (value: unknown): number | null => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Mirrors `src/features/groups/groups.battleState.ts` on the backend. The
 * caller passes `Date.now() + serverOffset` so the state follows server time.
 */
export const deriveBattleState = (
  battle: { status?: string | null; start_time?: string | null; end_time?: string | null } | null | undefined,
  nowMs: number = Date.now()
): BattleState => {
  if (!battle) return 'unknown';

  const status = String(battle.status ?? '').toLowerCase();
  if (status === 'cancelled') return 'cancelled';
  if (status === 'completed') return 'completed';

  const start = toEpoch(battle.start_time);
  const end = toEpoch(battle.end_time);

  if (start !== null && nowMs < start) return 'upcoming';
  if (start !== null && end !== null && nowMs >= start && nowMs < end) return 'live';
  if (end !== null && nowMs >= end) return 'grading';

  return 'unknown';
};

export const isFinalizable = (endTime: string | null | undefined, nowMs: number): boolean => {
  const end = toEpoch(endTime);
  return end !== null && nowMs >= end + FINALIZE_GRACE_MS;
};

export const serverOffsetMs = (serverNow: string | null | undefined): number => {
  const server = toEpoch(serverNow);
  return server === null ? 0 : server - Date.now();
};

export const secondsUntil = (target: string | null | undefined, nowMs: number): number => {
  const epoch = toEpoch(target);
  return epoch === null ? 0 : Math.max(0, Math.ceil((epoch - nowMs) / 1000));
};
