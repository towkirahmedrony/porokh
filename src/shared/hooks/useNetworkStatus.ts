import { useSyncExternalStore } from 'react';
import { getNetworkStatus, subscribeNetworkStatus } from '../lib/networkStatus';

/**
 * Subscribes to the app-wide connectivity signal. Use it for messaging and
 * empty states only — never to gate rendering, so cached content stays visible.
 */
export const useNetworkStatus = (): {
  status: 'online' | 'offline';
  isOnline: boolean;
  isOffline: boolean;
} => {
  const status = useSyncExternalStore(
    subscribeNetworkStatus,
    getNetworkStatus,
    getNetworkStatus
  );

  return {
    status,
    isOnline: status === 'online',
    isOffline: status === 'offline',
  };
};
