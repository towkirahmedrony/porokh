import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { pushBackInterceptor } from './backInterceptorRegistry';

/**
 * Close an overlay when Android Back is pressed.
 *
 * Call from every dismissible modal, dialog, sheet or drawer with `enabled`
 * set to whether it is currently open. Registration is native-only: on the web
 * the browser's own Back gesture drives React Router, and this hook must never
 * change that behaviour.
 */
export const useBackInterceptor = (onBack: () => void, enabled = true): void => {
  const handlerRef = useRef(onBack);

  // Keep the latest callback without re-registering on every render.
  useEffect(() => {
    handlerRef.current = onBack;
  });

  useEffect(() => {
    if (!enabled || !Capacitor.isNativePlatform()) return;

    return pushBackInterceptor(() => {
      handlerRef.current();
      return true;
    });
  }, [enabled]);
};
