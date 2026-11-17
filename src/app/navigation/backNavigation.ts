/**
 * Back navigation policy for the student app.
 *
 * Android hardware Back and gesture Back both arrive through the single
 * Capacitor `backButton` listener (see AndroidBackButton.tsx). This module is
 * the pure part of that decision: given the current route and the history
 * signals, decide whether to go back, to land on a safe parent page, or to
 * follow the app-level exit flow.
 *
 * The rules, in order:
 *
 *  1. Valid in-app history always wins. Back must never exit the app while a
 *     previous in-app page exists.
 *  2. With no history (cold start, direct/deep link, OTA or forced reload) the
 *     user must still land somewhere inside the app, never in Android's
 *     "finish the activity" path. Deep-linked nested routes therefore fall
 *     back to their closest parent route.
 *  3. Only the home/root pages (and the auth entry screens) may exit.
 */

/** Home/root destinations: back from here follows the app-level exit flow. */
const HOME_PATHS = new Set(['/', '/dashboard', '/dashboard/home']);

/**
 * Public auth screens are entry points of their own: with no history, Back is
 * expected to leave the app rather than jump into the protected shell.
 */
const EXIT_PATHS = new Set([
  ...HOME_PATHS,
  '/auth/login',
  '/auth/register',
  '/auth/callback',
  '/auth/forgot-password',
  '/auth/change-password',
  '/change-password',
]);

/**
 * Parent route for a nested page: keeping one level of context is closer to
 * the browser Back the user expected before the reload/deep link.
 */
const DYNAMIC_PARENTS: ReadonlyArray<{
  pattern: RegExp;
  parent: (match: RegExpExecArray) => string;
}> = [
  {
    pattern: /^\/exams\/model\/([^/]+)\/[^/]+$/,
    parent: (match) => `/exams/model/${match[1]}`,
  },
  {
    pattern: /^\/groups\/([^/]+)\/battles\/[^/]+$/,
    parent: (match) => `/groups/${match[1]}`,
  },
  {
    pattern: /^\/admission\/university\/([^/]+)\/unit\/[^/]+$/,
    parent: (match) => `/admission/university/${match[1]}`,
  },
];

/** Where Back lands when the current route has no history entry of its own. */
const DEEP_LINK_FALLBACKS: ReadonlyArray<readonly [RegExp, string]> = [
  // Notice detail -> notice list.
  [/^\/notices\/[^/]+$/, '/notices'],

  // Public profile -> own profile.
  [/^\/profile\/view\/[^/]+$/, '/profile'],

  // Remaining group screens -> group hub.
  [/^\/groups\/(?:new|leaderboard)$/, '/groups'],
  [/^\/groups\/[^/]+$/, '/groups'],

  // Model test drill-down: track -> category.
  [/^\/exams\/model\/[^/]+$/, '/exams/model'],

  // Practice/exam surfaces never fall back to a page that could be mistaken
  // for an exit; they return to the exam catalogue instead.
  [/^\/exam\/attempt\/[^/]+$/, '/exams/model'],
  [/^\/exam\/live$/, '/exams/model'],
  [/^\/exam\/challenge-play\/[^/]+$/, '/groups'],
  [/^\/exam\/analysis\/[^/]+$/, '/exam/analysis'],
  [/^\/exam\/analysis$/, '/history'],

  // Admission browser drill-down.
  [/^\/admission\/university\/[^/]+$/, '/admission'],
  // Includes admission exam attempts, which return to the admission
  // catalogue rather than anywhere near an exit.
  [/^\/admission\/.*$/, '/admission'],
  [/^\/admission$/, '/dashboard/home'],

  // Checkout -> plans.
  [/^\/premium\/checkout\/[^/]+$/, '/premium'],

  // Account and inbox screens fall back to their own hub.
  [/^\/(?:settings|edit-profile)$/, '/profile'],
  [/^\/(?:notifications|notices)$/, '/dashboard/home'],
];

/** Deep-link fallback for a route without its own back entry. */
export const resolveFallbackPath = (pathname: string): string => {
  const path = normalizePathname(pathname);

  for (const { pattern, parent } of DYNAMIC_PARENTS) {
    const match = pattern.exec(path);
    if (match) return parent(match);
  }

  for (const [pattern, target] of DEEP_LINK_FALLBACKS) {
    if (pattern.test(path)) return target;
  }

  return '/dashboard/home';
};

/** True when the route is a tab/root page where Back may leave the app. */
export const isExitPath = (pathname: string): boolean =>
  EXIT_PATHS.has(normalizePathname(pathname));

/** Route path without query string, hash or trailing slash. */
export const normalizePathname = (pathname: string): string => {
  const path = (pathname || '/').split('?')[0].split('#')[0];
  if (path.length > 1 && path.endsWith('/')) return path.replace(/\/+$/, '');
  return path || '/';
};

export interface BackDecisionInput {
  /** Current route pathname. */
  pathname: string;
  /** Capacitor's `canGoBack` for the WebView at the moment of the press. */
  canGoBack: boolean;
  /** React Router's history index (`window.history.state.idx`). */
  historyIndex: number;
  /** An exam/practice/battle currently holds in-memory progress. */
  examActive?: boolean;
}

export type BackDecision =
  | { type: 'history' }
  | { type: 'navigate'; to: string; replace: boolean }
  | { type: 'exit' };

/**
 * Decide one Back press. `history` actions are left to React Router so the
 * router state stays in sync; nothing here calls `window.history` directly.
 */
export const decideBackNavigation = ({
  pathname,
  canGoBack,
  historyIndex,
  examActive = false,
}: BackDecisionInput): BackDecision => {
  // 1. Any real previous page wins, including one restored after a reload.
  if (canGoBack || historyIndex > 0) {
    return { type: 'history' };
  }

  const path = normalizePathname(pathname);

  // 2. An active exam is never allowed to reach the exit flow: return to the
  //    closest exam surface instead. Attempts and answers live on the server,
  //    so this keeps progress while never closing the app mid-exam.
  if (examActive) {
    return { type: 'navigate', to: resolveFallbackPath(path), replace: true };
  }

  // 3. Only genuine root/auth entry screens may exit.
  if (isExitPath(path)) {
    return { type: 'exit' };
  }

  // 4. Deep links and reloads of nested routes land on their parent page.
  return { type: 'navigate', to: resolveFallbackPath(path), replace: true };
};
