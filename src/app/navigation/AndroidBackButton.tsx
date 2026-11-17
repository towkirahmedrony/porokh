import React, { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import toast from 'react-hot-toast';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { hasExamActivity, isExamRoute } from '@/features/app-update/examActivity';
import { OTA_EXAM_ROUTE_PATTERNS } from '@/features/app-update/config';
import { runTopBackInterceptor } from './backInterceptorRegistry';
import { decideBackNavigation, normalizePathname } from './backNavigation';

/** Two presses inside this window confirm the app-level exit at the root. */
const EXIT_CONFIRM_WINDOW_MS = 2_000;

/** Guard against one native press being delivered twice by two listeners. */
const DUPLICATE_PRESS_WINDOW_MS = 60;

/**
 * How long to wait before concluding that `navigate(-1)` had nowhere to go.
 * A WebView reload (OTA update, forced reload) can leave `history.state.idx`
 * set while the native history has been reset.
 */
const HISTORY_VERIFY_MS = 450;

/** React Router stores the history index in `history.state`. */
const readHistoryIndex = (): number => {
  const state = window.history.state as { idx?: unknown } | null;
  return typeof state?.idx === 'number' ? state.idx : 0;
};

/**
 * Single owner of the Android hardware/gesture Back button.
 *
 * Mounted exactly once inside the router. It replaces Capacitor's default
 * behaviour (which only asks the WebView whether it can go back) with the app
 * policy in `backNavigation.ts`, in this order:
 *
 *  1. close the topmost modal/dialog/sheet/drawer,
 *  2. respect an active exam,
 *  3. go back through React Router when any in-app history exists,
 *  4. otherwise fall back to a parent page, never straight out of a nested
 *     route,
 *  5. only the home/auth roots exit, after a second confirming press.
 *
 * Registration happens once for the app lifetime; the handler reads current
 * route and language from refs so navigation never re-binds the listener.
 */
export const AndroidBackButton: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const navigateRef = useRef(navigate);
  const pathnameRef = useRef(location.pathname);
  const tRef = useRef(t);

  const exitArmedAtRef = useRef(0);
  const exitTimerRef = useRef<number | null>(null);
  const lastPressAtRef = useRef(0);
  const listenerActiveRef = useRef(false);
  const locationKeyRef = useRef(location.key);
  const historyIndexTrustedRef = useRef(true);
  const verifyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (locationKeyRef.current !== location.key) {
      // A navigation landed: the history index is trustworthy again, and an
      // earlier exit warning no longer applies to this page.
      locationKeyRef.current = location.key;
      historyIndexTrustedRef.current = true;
      exitArmedAtRef.current = 0;
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    }
    navigateRef.current = navigate;
    pathnameRef.current = location.pathname;
    tRef.current = t;
  });

  useEffect(
    () => () => {
      if (verifyTimerRef.current !== null) {
        window.clearTimeout(verifyTimerRef.current);
      }
    },
    []
  );

  const clearExitTimer = useCallback(() => {
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  /**
   * Root-page exit follows the Android convention: the first press only warns,
   * the second press inside the window leaves the app. Nothing is destroyed and
   * a mistyped Back can never close the app.
   */
  const requestExit = useCallback(() => {
    const now = Date.now();

    if (now - exitArmedAtRef.current <= EXIT_CONFIRM_WINDOW_MS) {
      exitArmedAtRef.current = 0;
      clearExitTimer();
      void App.exitApp();
      return;
    }

    exitArmedAtRef.current = now;
    clearExitTimer();
    exitTimerRef.current = window.setTimeout(() => {
      exitArmedAtRef.current = 0;
      exitTimerRef.current = null;
    }, EXIT_CONFIRM_WINDOW_MS);

    toast(tRef.current('nav.pressBackAgainToExit'), { id: 'android-back-exit' });
  }, [clearExitTimer]);

  const handleBack = useCallback(
    (canGoBack: boolean) => {
      const now = Date.now();
      if (now - lastPressAtRef.current < DUPLICATE_PRESS_WINDOW_MS) return;
      lastPressAtRef.current = now;

      // 1. Overlays consume Back first (topmost only).
      if (runTopBackInterceptor()) return;

      const pathname = pathnameRef.current;
      const examActive =
        hasExamActivity() || isExamRoute(pathname, OTA_EXAM_ROUTE_PATTERNS);
      const decision = decideBackNavigation({
        pathname,
        canGoBack,
        historyIndex: historyIndexTrustedRef.current ? readHistoryIndex() : 0,
        examActive,
      });

      // 2-4. React Router owns all navigation, so its history stays correct.
      if (decision.type === 'history') {
        const keyBeforeBack = locationKeyRef.current;
        const pathBeforeBack = pathname;

        navigateRef.current(-1);

        // If the browser had no real predecessor, do not leave the press as a
        // silent no-op: land on the safe parent page instead of the system
        // exit path. History is then treated as empty for the next press.
        if (verifyTimerRef.current !== null) {
          window.clearTimeout(verifyTimerRef.current);
        }
        verifyTimerRef.current = window.setTimeout(() => {
          verifyTimerRef.current = null;
          if (locationKeyRef.current !== keyBeforeBack) return;

          historyIndexTrustedRef.current = false;
          const fallback = decideBackNavigation({
            pathname: pathBeforeBack,
            canGoBack: false,
            historyIndex: 0,
            examActive,
          });
          if (
            fallback.type === 'navigate' &&
            normalizePathname(fallback.to) !== normalizePathname(pathBeforeBack)
          ) {
            navigateRef.current(fallback.to, { replace: true });
          }
        }, HISTORY_VERIFY_MS);
        return;
      }

      if (decision.type === 'navigate') {
        navigateRef.current(decision.to, { replace: decision.replace });
        return;
      }

      requestExit();
    },
    [requestExit]
  );

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    listenerActiveRef.current = true;
    let cancelled = false;
    let removeListener: (() => void) | null = null;

    void App.addListener('backButton', ({ canGoBack }) => {
      if (!listenerActiveRef.current) return;
      handleBack(Boolean(canGoBack));
    }).then((handle) => {
      if (cancelled) {
        // StrictMode/unmount happened before the native handle resolved.
        void handle.remove();
        return;
      }
      removeListener = () => {
        void handle.remove();
      };
    });

    return () => {
      cancelled = true;
      listenerActiveRef.current = false;
      removeListener?.();
      clearExitTimer();
    };
  }, [handleBack, clearExitTimer]);

  return null;
};

export default AndroidBackButton;
