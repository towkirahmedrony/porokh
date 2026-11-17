/**
 * Which state a history tab should render.
 *
 * A failed request must never be presented as a successful empty result: the
 * "no mistakes yet" empty state is only allowed when the request succeeded and
 * returned zero rows. Anything else is an error with a retry action.
 */
export type TabViewState = 'loading' | 'error' | 'empty' | 'content';

interface ResolveTabViewStateArgs {
  isLoading: boolean;
  isError: boolean;
  itemCount: number;
}

export const resolveTabViewState = ({
  isLoading,
  isError,
  itemCount,
}: ResolveTabViewStateArgs): TabViewState => {
  if (isLoading) return 'loading';

  // Keep already-loaded rows visible when only a background refetch failed.
  if (isError && itemCount === 0) return 'error';
  if (itemCount === 0) return 'empty';

  return 'content';
};
