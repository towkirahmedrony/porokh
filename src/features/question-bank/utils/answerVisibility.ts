import {
  EMPTY_EXPLANATION_VISIBILITY,
  toggleExplanationVisibility,
  type ExplanationVisibilityState,
} from './explanationVisibility';

export interface QuestionBankRevealState {
  answersRevealed: boolean;
  expandedExplanationIds: ExplanationVisibilityState;
}

export const INITIAL_REVEAL_STATE: QuestionBankRevealState = {
  answersRevealed: false,
  expandedExplanationIds: EMPTY_EXPLANATION_VISIBILITY,
};

export type QuestionBankRevealAction =
  | { type: 'toggle-answers' }
  | { type: 'toggle-explanation'; questionId: string }
  | { type: 'reset' };

export function revealReducer(
  state: QuestionBankRevealState,
  action: QuestionBankRevealAction
): QuestionBankRevealState {
  switch (action.type) {
    case 'toggle-answers':
      return {
        answersRevealed: !state.answersRevealed,
        expandedExplanationIds: EMPTY_EXPLANATION_VISIBILITY,
      };
    case 'toggle-explanation':
      if (!state.answersRevealed) return state;
      return {
        ...state,
        expandedExplanationIds: toggleExplanationVisibility(
          state.expandedExplanationIds,
          action.questionId
        ),
      };
    case 'reset':
      return INITIAL_REVEAL_STATE;
    default:
      return state;
  }
}

export function isExplanationExpanded(
  questionId: string,
  state: QuestionBankRevealState
): boolean {
  return state.expandedExplanationIds.has(questionId);
}
