export type ExplanationVisibilityState = ReadonlySet<string>;

export const EMPTY_EXPLANATION_VISIBILITY: ExplanationVisibilityState = new Set();

export function isExplanationVisible(
  questionId: string,
  state: ExplanationVisibilityState
): boolean {
  return state.has(questionId);
}

export function toggleExplanationVisibility(
  state: ExplanationVisibilityState,
  questionId: string
): ExplanationVisibilityState {
  const next = new Set(state);
  if (next.has(questionId)) next.delete(questionId);
  else next.add(questionId);
  return next;
}
