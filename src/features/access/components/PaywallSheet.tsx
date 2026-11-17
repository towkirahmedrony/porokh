import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Crown, Lock, Timer, X } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { useBackInterceptor } from '@/app/navigation/useBackInterceptor';
import { localizeDigits } from '@/shared/i18n/messages';
import Button from '@/shared/components/ui/Button';
import type { PaywallState } from '../types';

interface PaywallSheetProps {
  state: PaywallState | null;
  onClose: () => void;
}

/**
 * Countdown label in the active language. The remaining time always comes from
 * the server-provided `reset_at`; only the formatting is local.
 */
const formatCountdown = (
  ms: number,
  t: (key: 'premium.duration_minutes' | 'premium.duration_hours' | 'premium.duration_hours_minutes', values: Record<string, string | number>) => string,
  localize: (value: string | number) => string
): string => {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));

  if (totalMinutes < 1) {
    return t('premium.duration_minutes', { n: localize(1) });
  }
  if (totalMinutes < 60) {
    return t('premium.duration_minutes', { n: localize(totalMinutes) });
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0
    ? t('premium.duration_hours_minutes', { h: localize(hours), m: localize(minutes) })
    : t('premium.duration_hours', { n: localize(hours) });
};

export const PaywallSheet = ({ state, onClose }: PaywallSheetProps) => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [now, setNow] = useState(() => Date.now());

  // Back closes the paywall sheet, never the page underneath it.
  useBackInterceptor(onClose, Boolean(state));

  const resetAt = state?.reason === 'free_limit' ? state.resetAt ?? null : null;

  // Live countdown while the sheet is open; the value is derived from the
  // server-provided reset timestamp, never from a hardcoded duration.
  useEffect(() => {
    if (!state || !resetAt) return;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [state, resetAt]);

  useEffect(() => {
    if (!state) return;
    setNow(Date.now());
  }, [state]);

  useEffect(() => {
    if (!state) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [state, onClose]);

  const countdown = useMemo(() => {
    if (!resetAt) return null;
    const target = Date.parse(resetAt);
    if (Number.isNaN(target)) return null;
    const remaining = target - now;
    if (remaining <= 0) return t('premium.resets_now');
    return t('premium.resets_in', {
      time: formatCountdown(remaining, t, (value) => localizeDigits(value, language)),
    });
  }, [resetAt, now, t, language]);

  const handleUpgrade = useCallback(() => {
    onClose();
    navigate('/premium');
  }, [navigate, onClose]);

  if (!state || typeof document === 'undefined') return null;

  const isFreeLimit = state.reason === 'free_limit';
  const limit = state.limit ?? null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label={t('premium.close')}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={isFreeLimit ? t('premium.limit_title') : t('premium.premium_required_title')}
        className="relative w-full max-w-md rounded-t-3xl border border-card-border bg-card-bg p-5 pb-8 shadow-2xl animate-in slide-in-from-bottom duration-300 sm:rounded-3xl sm:pb-5"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('premium.close')}
          className="absolute right-3 top-3 rounded-full p-2 text-text-secondary hover:bg-surface"
        >
          <X size={18} />
        </button>

        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          {isFreeLimit ? <Timer size={26} /> : <Lock size={26} />}
        </div>

        <h2 className="text-center text-xl font-bold text-text-primary">
          {isFreeLimit ? t('premium.limit_title') : t('premium.premium_required_title')}
        </h2>

        <p className="mt-2 text-center text-sm leading-relaxed text-text-secondary">
          {isFreeLimit
            ? t('premium.limit_msg', {
                limit: limit !== null ? localizeDigits(limit, language) : '-',
              })
            : t('premium.premium_required_msg')}
        </p>

        {isFreeLimit && countdown ? (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm font-medium text-text-primary">
            <Timer size={16} className="text-primary" />
            <span>{countdown}</span>
          </div>
        ) : null}

        <div className="mt-6 space-y-2">
          <Button
            className="w-full gap-2 py-3 text-base font-semibold"
            onClick={handleUpgrade}
          >
            <Crown size={18} />
            {t('premium.cta_get_premium')}
          </Button>
          <Button variant="ghost" className="w-full py-2.5" onClick={onClose}>
            {t('premium.cta_later')}
          </Button>
        </div>

        {isFreeLimit && limit !== null ? (
          <p className="mt-3 text-center text-[11px] text-text-secondary">
            {t('premium.current_limit', { limit: localizeDigits(limit, language) })}
          </p>
        ) : null}
      </div>
    </div>,
    document.body
  );
};

export default PaywallSheet;
