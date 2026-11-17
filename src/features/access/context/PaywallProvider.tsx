import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import PaywallSheet from '../components/PaywallSheet';
import type { PaywallState } from '../types';

interface PaywallContextValue {
  openPaywall: (state: PaywallState) => void;
  closePaywall: () => void;
  isOpen: boolean;
}

interface AccessErrorDetail {
  code?: string;
  details?: Record<string, unknown> | null;
}

const PaywallContext = createContext<PaywallContextValue | null>(null);

const toNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const toStringOrNull = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

export const PaywallProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<PaywallState | null>(null);

  const openPaywall = useCallback((next: PaywallState) => setState(next), []);
  const closePaywall = useCallback(() => setState(null), []);

  // Any API response that is rejected for quota or premium reasons opens the
  // matching paywall state, including failures from screens that do not render
  // the paywall themselves.
  useEffect(() => {
    const onAccessError = (event: Event) => {
      const detail = (event as CustomEvent<AccessErrorDetail>).detail;
      if (!detail?.code) return;

      if (detail.code === 'FREE_LIMIT_REACHED') {
        setState({
          reason: 'free_limit',
          limit: toNumber(detail.details?.limit),
          resetAt: toStringOrNull(detail.details?.reset_at),
        });
        return;
      }

      if (detail.code === 'PREMIUM_REQUIRED') {
        setState({ reason: 'premium_content' });
      }
    };

    window.addEventListener('access:error', onAccessError);
    return () => window.removeEventListener('access:error', onAccessError);
  }, []);

  const value = useMemo<PaywallContextValue>(
    () => ({ openPaywall, closePaywall, isOpen: !!state }),
    [openPaywall, closePaywall, state]
  );

  return (
    <PaywallContext.Provider value={value}>
      {children}
      <PaywallSheet state={state} onClose={closePaywall} />
    </PaywallContext.Provider>
  );
};

export const usePaywall = (): PaywallContextValue => {
  const context = useContext(PaywallContext);
  if (!context) {
    throw new Error('usePaywall must be used inside a PaywallProvider');
  }
  return context;
};

export default PaywallProvider;
