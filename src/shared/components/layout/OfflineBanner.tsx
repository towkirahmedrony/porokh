import React from 'react';
import { CloudOff } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';

/**
 * Slim, non-blocking connectivity notice.
 *
 * It never covers content: the dashboard below stays fully usable with its
 * cached data. It exists so a user understands why some numbers may be older
 * than usual, instead of assuming the app is broken.
 */
const OfflineBanner: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t } = useLanguage();
  const { isOffline } = useNetworkStatus();

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-amber-700 dark:text-amber-300 ${className}`}
    >
      <CloudOff size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p className="font-['Hind_Siliguri'] text-xs leading-5 text-text-primary">
        <span className="font-bold">{t('offline.bannerTitle')}</span>
        {' — '}
        {t('offline.bannerBody')}
      </p>
    </div>
  );
};

export default OfflineBanner;
