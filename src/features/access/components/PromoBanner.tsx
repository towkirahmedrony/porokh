import { useEffect, useMemo, useState } from 'react';
import { Gift, X } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { LOCALE_BY_LANGUAGE } from '@/shared/i18n/messages';
import { useAccess } from '../hooks/useAccess';

const STORAGE_PREFIX = 'parapoth:promo-dismissed:';

export const PromoBanner = ({ className = '' }: { className?: string }) => {
  const { t, language } = useLanguage();
  const { access, isAuthenticated } = useAccess();
  const [dismissed, setDismissed] = useState(false);

  const isPromotion = access?.source === 'grant_all' && !!access?.premium;
  const expiresAt = access?.premium_expires_at ?? null;

  // Dismissal is scoped to the promotion instance (its expiry), so a new
  // promotion is announced again instead of being hidden forever.
  const storageKey = useMemo(
    () => `${STORAGE_PREFIX}${expiresAt ?? 'no-expiry'}`,
    [expiresAt]
  );

  useEffect(() => {
    if (!isPromotion) {
      setDismissed(false);
      return;
    }
    try {
      setDismissed(window.localStorage.getItem(storageKey) === '1');
    } catch {
      setDismissed(false);
    }
  }, [isPromotion, storageKey]);

  if (!isAuthenticated || !isPromotion || dismissed) return null;

  const formattedDate = expiresAt
    ? new Date(expiresAt).toLocaleDateString(LOCALE_BY_LANGUAGE[language], {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const message = formattedDate
    ? t('premium.promo_banner', { date: formattedDate })
    : t('premium.promo_banner_no_expiry');

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(storageKey, '1');
    } catch {
      // Storage can be unavailable (private mode); dismissal still applies for
      // this session and never affects the user's actual access.
    }
  };

  return (
    <div
      role="status"
      className={`flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-primary ${className}`}
    >
      <Gift size={18} className="mt-0.5 shrink-0" />
      <p className="flex-1 text-sm font-medium leading-snug">{message}</p>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label={t('premium.dismiss')}
        className="rounded-full p-1 hover:bg-primary/10"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default PromoBanner;
