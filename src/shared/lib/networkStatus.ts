/**
 * App-wide connectivity signal.
 *
 * `navigator.onLine` alone is not evidence of reachability: a device can be
 * joined to a Wi-Fi network with no route, and an Android WebView reports that
 * as online. This store therefore treats *either* signal as offline evidence:
 *
 *  - the browser's offline event / `navigator.onLine === false`
 *  - a request that failed without any HTTP response (see apiClient)
 *
 * Any successful response, or the browser's online event, clears it again. The
 * UI only uses this to *explain* what it is showing; it never gates rendering,
 * because cached content must stay usable.
 */
export type NetworkStatus = 'online' | 'offline';

const listeners = new Set<() => void>();

const readNavigatorStatus = (): NetworkStatus => {
  if (typeof navigator === 'undefined') return 'online';
  return navigator.onLine === false ? 'offline' : 'online';
};

let current: NetworkStatus = readNavigatorStatus();

const emit = () => {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.warn('Network status listener failed:', error);
    }
  });
};

const setStatus = (next: NetworkStatus) => {
  if (next === current) return;
  current = next;
  emit();
};

export const getNetworkStatus = (): NetworkStatus => current;

export const subscribeNetworkStatus = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** A request reached no server at all (DNS failure, timeout, no route). */
export const reportNetworkFailure = (): void => {
  setStatus('offline');
};

/** A request completed, so the network is usable again. */
export const reportNetworkSuccess = (): void => {
  setStatus(readNavigatorStatus());
};

/**
 * Binds the browser events once per page load. Safe to call repeatedly; the
 * first call installs the listeners.
 */
let bound = false;
export const bindNetworkStatusListeners = (): void => {
  if (bound || typeof window === 'undefined') return;
  bound = true;

  const handleOnline = () => setStatus('online');
  const handleOffline = () => setStatus('offline');

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
};

bindNetworkStatusListeners();
