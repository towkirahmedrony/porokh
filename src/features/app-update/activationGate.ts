import type { OfflineExamStorage } from '../exam/offline/storage';
import { OTA_EXAM_ROUTE_PATTERNS } from './config';
import { isExamRoute } from './examActivity';
import type {
  ActivationDecision,
  AuthSnapshot,
  ExamActivity,
  OtaBlockReason,
} from './types';

export type ActivationStorage = Pick<
  OfflineExamStorage,
  'init' | 'listPendingWork' | 'listAttemptsForUser'
>;

export type ActivationGateContext = {
  auth: AuthSnapshot;
  storage: ActivationStorage;
  activities: ExamActivity[];
  /** Extra defence-in-depth: exam pages register activity too, but a cold start
   * into an exam route must never be reloaded before that effect runs. */
  pathname?: string;
};

const runtimeReason = (activity: ExamActivity): OtaBlockReason => {
  switch (activity.kind) {
    case 'recovery':
      return 'recovery_in_progress';
    case 'submission_pending':
      return 'submission_pending';
    case 'pending_answers':
      return 'pending_answers';
    case 'practice_active':
      return 'practice_active';
    case 'battle_active':
      return 'battle_active';
    default:
      return 'exam_active';
  }
};

/**
 * Decide whether an update may reload the WebView right now.
 *
 * Three independent signals:
 *
 *  - runtime activity registered by mounted exam, practice and battle pages;
 *  - the persisted attempt/submission/answer state, counted **across every
 *    stored user** so signing out cannot hide a queued submission;
 *  - the current route, as a last-resort guard for a cold start that lands on
 *    an exam page before its effect has run.
 *
 * The route is never the only signal.
 */
export const evaluateActivationGate = async (
  context: ActivationGateContext
): Promise<ActivationDecision> => {
  const reasons = new Set<OtaBlockReason>();

  for (const activity of context.activities) {
    reasons.add(runtimeReason(activity));
  }

  if (
    context.pathname &&
    isExamRoute(context.pathname, OTA_EXAM_ROUTE_PATTERNS)
  ) {
    reasons.add('exam_route');
  }

  if (context.auth.state === 'unknown') {
    reasons.add('auth_unknown');
  } else if (
    context.auth.state === 'authenticated' &&
    !context.auth.userId
  ) {
    // An authenticated state without an id cannot be reconciled with stored
    // work, so it is treated as unknown rather than as "nothing pending".
    reasons.add('auth_unknown');
  }

  try {
    await context.storage.init();
    const pending = await context.storage.listPendingWork();

    if (pending.inProgressAttempts > 0) reasons.add('attempt_unresolved');
    if (pending.pendingSubmissions > 0) reasons.add('submission_pending');
    if (pending.pendingAnswers > 0) reasons.add('pending_answers');

    /**
     * Defence in depth for stores that cannot count globally: the per-user view
     * is still checked, so a partial implementation never silently degrades
     * into "nothing pending".
     */
    if (
      pending.inProgressAttempts === 0 &&
      pending.pendingSubmissions === 0 &&
      pending.pendingAnswers === 0 &&
      context.auth.state === 'authenticated' &&
      context.auth.userId
    ) {
      const attempts = await context.storage.listAttemptsForUser(
        context.auth.userId
      );
      if (attempts.some((attempt) => attempt.status === 'in_progress')) {
        reasons.add('attempt_unresolved');
      }
    }
  } catch {
    reasons.add('storage_unavailable');
  }

  return {
    allowed: reasons.size === 0,
    reasons: [...reasons],
  };
};

export const isExamBusy = (
  activities: ExamActivity[],
  pathname?: string
): boolean =>
  activities.length > 0 ||
  Boolean(pathname && isExamRoute(pathname, OTA_EXAM_ROUTE_PATTERNS));
