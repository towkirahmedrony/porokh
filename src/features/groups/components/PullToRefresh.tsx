import React, { useRef, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';

type PullToRefreshProps = {
  onRefresh: () => Promise<unknown> | void;
  children: React.ReactNode;
};

const THRESHOLD = 60;

/**
 * Lightweight touch pull-to-refresh. The app scrolls inside <main>, not the
 * document, so the gesture only starts when that container is at the top.
 */
export const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children }) => {
  const { t } = useLanguage();
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const atTop = (target: EventTarget | null): boolean => {
    const element = target instanceof Element ? target : null;
    const main = element?.closest('main') ?? document.querySelector('main');
    return !main || main.scrollTop <= 0;
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!atTop(event.target) || refreshing) return;
    startY.current = event.touches[0]?.clientY ?? null;
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (startY.current === null) return;
    const current = event.touches[0]?.clientY ?? startY.current;
    const delta = current - startY.current;
    setPull(Math.max(0, Math.min(90, delta)));
  };

  const handleTouchEnd = async () => {
    if (startY.current === null) return;
    const shouldRefresh = pull >= THRESHOLD;
    startY.current = null;
    setPull(0);

    if (!shouldRefresh || refreshing) return;

    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div
        className="flex items-center justify-center overflow-hidden text-xs text-text-secondary transition-all"
        style={{ height: refreshing ? 32 : Math.min(32, pull / 2) }}
      >
        {refreshing ? (
          <span className="inline-flex items-center gap-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('common.loading')}
          </span>
        ) : pull >= THRESHOLD ? (
          <RefreshCw className="h-4 w-4" />
        ) : null}
      </div>
      {children}
    </div>
  );
};

export default PullToRefresh;
