/**
 * LIFO registry of overlays that consume a Back press.
 *
 * Modals, dialogs, sheets and drawers are plain React state: the WebView's
 * history knows nothing about them, so without this registry Back would leave
 * the page (or the app) while an overlay is still open. Each overlay
 * registers while it is open and only the topmost one is asked to close.
 */
export type BackInterceptor = () => boolean;

interface RegisteredInterceptor {
  id: symbol;
  handler: BackInterceptor;
}

const interceptorStack: RegisteredInterceptor[] = [];

/**
 * Register a topmost-first Back handler. Returns an idempotent unregister
 * function for the owning effect's cleanup.
 */
export const pushBackInterceptor = (handler: BackInterceptor): (() => void) => {
  const entry: RegisteredInterceptor = { id: Symbol('back-interceptor'), handler };
  interceptorStack.push(entry);

  let removed = false;
  return () => {
    if (removed) return;
    removed = true;

    const index = interceptorStack.findIndex((item) => item.id === entry.id);
    if (index >= 0) interceptorStack.splice(index, 1);
  };
};

export const getBackInterceptorCount = (): number => interceptorStack.length;

/**
 * Ask the topmost interceptor to handle the press, falling through to the
 * next one only when the topmost reports it cannot (for example a blocking
 * overlay that must not be dismissed). Returns true when one handled it.
 *
 * A throwing handler is treated as "not handled" so a broken overlay can never
 * swallow Back entirely.
 */
export const runTopBackInterceptor = (): boolean => {
  for (let index = interceptorStack.length - 1; index >= 0; index -= 1) {
    const entry = interceptorStack[index];
    if (!entry) continue;

    try {
      if (entry.handler()) return true;
    } catch {
      // Fall through to the next interceptor.
    }
  }

  return false;
};

/** Test-only reset. */
export const resetBackInterceptorsForTests = (): void => {
  interceptorStack.length = 0;
};
