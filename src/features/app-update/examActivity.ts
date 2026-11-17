import type { ExamActivity, ExamActivityKind } from './types';

type Listener = (activities: ExamActivity[]) => void;

const activities = new Map<string, ExamActivity>();
const listeners = new Set<Listener>();
const releaseTokens = new Map<string, symbol>();

const emit = (): void => {
  const snapshot = getExamActivities();
  for (const listener of [...listeners]) {
    try {
      listener(snapshot);
    } catch {
      // A broken subscriber must never prevent other listeners from running.
    }
  }
};

/**
 * Register a runtime exam operation. Tokens make this safe for React
 * StrictMode double-effects: the second begin for the same id is a no-op and
 * only the token that created the entry can release it.
 */
export const beginExamActivity = (
  id: string,
  kind: ExamActivityKind
): (() => void) => {
  if (!id) return () => undefined;

  if (!activities.has(id)) {
    activities.set(id, { id, kind, startedAt: Date.now() });
    const token = Symbol(id);
    releaseTokens.set(id, token);
    emit();

    return () => {
      if (releaseTokens.get(id) !== token) return;
      releaseTokens.delete(id);
      activities.delete(id);
      emit();
    };
  }

  return () => undefined;
};

export const getExamActivities = (): ExamActivity[] =>
  [...activities.values()].sort((a, b) => a.startedAt - b.startedAt);

export const hasExamActivity = (): boolean => activities.size > 0;

export const subscribeExamActivity = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const isExamRoute = (
  pathname: string,
  patterns: RegExp[]
): boolean => {
  const path = pathname.split('?')[0];
  return patterns.some((pattern) => pattern.test(path));
};

/** Test-only reset. */
export const resetExamActivityForTests = (): void => {
  activities.clear();
  releaseTokens.clear();
  listeners.clear();
};
