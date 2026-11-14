import React, { memo, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { resolveHomeIcon } from '@/shared/utils/homeIcons';
import { resolveHomeColor } from '@/shared/utils/homeColors';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import type { GridItem } from '../hooks/useHomeGrids';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { pickLang } from '@/shared/i18n/localize';

const SKELETON_COUNT = 6;

export interface ThemeConfig {
  active_theme?: string;
  greeting_bg_url?: string;
}

interface FeatureGridProps {
  features: GridItem[];
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  themeConfig?: ThemeConfig;
  loadingLabel?: string;
  /** Connectivity state, used only to explain an empty grid. */
  offline?: boolean;
}

const isExternalLink = (value: string) => /^https?:\/\//i.test(value);
const isInternalLink = (value: string) => value.startsWith('/');

interface CardVisualProps {
  item: GridItem;
}

const CardVisual: React.FC<CardVisualProps> = ({ item }) => {
  const imageUrl = item.image_url?.trim() ?? '';
  const [imageFailed, setImageFailed] = useState(false);
  const color = resolveHomeColor(item.color);
  const Icon = resolveHomeIcon(item.icon_name);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  return (
    <div
      className="relative z-10 flex h-10 w-10 items-center justify-center rounded-[14px] border border-card-border bg-badge-bg text-badge-text"
      style={color ? { color } : undefined}
    >
      {imageUrl && !imageFailed ? (
        <img
          src={imageUrl}
          alt={item.title}
          width={24}
          height={24}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="h-6 w-6 object-contain"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Icon
          className="h-5 w-5"
          strokeWidth={2.2}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

const FeatureGrid: React.FC<FeatureGridProps> = memo(
  ({ features, loading = false, error, onRetry, loadingLabel, offline = false }) => {
    const { language, t } = useLanguage();

    /**
     * No cached cards and no connection: the user has never downloaded the
     * dashboard on this device. This is a first-run-online state, not a failure,
     * so it is worded as such instead of showing a bare error.
     */
    if (!features.length && offline && !loading) {
      return (
        <div
          role="status"
          className="rounded-[22px] border border-card-border bg-card-bg px-4 py-6 text-center"
        >
          <p className="font-['Noto_Sans_Bengali'] text-base font-bold leading-6 text-text-primary">
            {t('offline.dashboardEmptyTitle')}
          </p>
          <p className="mt-2 font-['Noto_Sans_Bengali'] text-sm leading-6 text-text-secondary">
            {t('offline.dashboardEmptyBody')}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {t('common.retry')}
            </button>
          )}
        </div>
      );
    }

    if (loading) {
      return (
        <div
          className="grid grid-cols-3 gap-2.5"
          role={loadingLabel ? 'status' : undefined}
          aria-label={loadingLabel}
        >
          {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
            <Skeleton
              key={`feature-skeleton-${index}`}
              className="h-[112px] rounded-[18px] bg-surface-elevated"
            />
          ))}
        </div>
      );
    }

    if (error && features.length === 0) {
      return (
        <div
          role="alert"
          className="rounded-[22px] border border-card-border bg-card-bg px-4 py-5 text-center"
        >
          <p className="font-['Noto_Sans_Bengali'] text-sm font-semibold leading-6 text-text-primary">
            {t('home.featuresLoadFailed')}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {t('common.retry')}
            </button>
          )}
        </div>
      );
    }

    if (!features.length) return null;

    return (
      <div className="grid grid-cols-3 gap-2.5">
        {features.map((item) => {
          const link = item.link?.trim() ?? '';
          const hasValidLink = link.length > 0 && (isExternalLink(link) || isInternalLink(link));
          const color = resolveHomeColor(item.color);
          const background = resolveHomeColor(item.bg_color);
          const label =
            pickLang(language, item.title_bn || item.title, item.title_en) ||
            item.title;

          const content = (
            <>
              <CardVisual item={item} />

              <div className="relative z-10 mt-2 flex min-h-8 flex-1 flex-col items-center justify-center">
                <span
                  className="line-clamp-2 select-none font-['Noto_Sans_Bengali'] text-[13px] font-semibold leading-snug text-pretty !no-underline [text-decoration-line:none!important] text-text-primary"
                  style={color ? { color } : undefined}
                >
                  {label}
                </span>
              </div>
            </>
          );

          const baseClassName =
            'relative flex min-h-[112px] select-none touch-manipulation !no-underline [text-decoration-line:none!important] [-webkit-tap-highlight-color:transparent] flex-col items-center justify-center overflow-hidden rounded-[18px] border border-card-border bg-card-bg px-2 py-3 text-center transition-[transform,background-color,border-color] duration-150 motion-reduce:transition-none active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

          const cardProps = {
            className: baseClassName,
            style: background ? { backgroundColor: background } : undefined,
          };

          if (!hasValidLink) {
            return (
              <div key={item.id} {...cardProps}>
                {content}
              </div>
            );
          }

          if (isExternalLink(link)) {
            return (
              <a
                key={item.id}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                {...cardProps}
              >
                {content}
              </a>
            );
          }

          return (
            <Link key={item.id} to={link} {...cardProps}>
              {content}
            </Link>
          );
        })}
      </div>
    );
  }
);

FeatureGrid.displayName = 'FeatureGrid';

export default FeatureGrid;
