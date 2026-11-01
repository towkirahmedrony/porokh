import React, { memo, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { resolveHomeIcon } from '@/shared/utils/homeIcons';
import { resolveHomeColor } from '@/shared/utils/homeColors';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import type { GridItem } from '../hooks/useHomeGrids';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { pickLang } from '@/shared/i18n/localize';

const SKELETON_COUNT = 4;

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
      className="relative z-10 flex h-12 w-12 items-center justify-center rounded-[16px] border border-card-border bg-badge-bg text-badge-text"
      style={color ? { color } : undefined}
    >
      {imageUrl && !imageFailed ? (
        <img
          src={imageUrl}
          alt={item.title}
          width={28}
          height={28}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="h-7 w-7 object-contain transition-transform duration-200 group-hover:scale-105"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Icon
          className="h-6 w-6 transition-transform duration-200 group-hover:scale-105"
          strokeWidth={2.2}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

const FeatureGrid: React.FC<FeatureGridProps> = memo(
  ({ features, loading = false, error, onRetry, loadingLabel }) => {
    const { language, t } = useLanguage();

    if (loading) {
      return (
        <div
          className="grid grid-cols-2 gap-3"
          role={loadingLabel ? 'status' : undefined}
          aria-label={loadingLabel}
        >
          {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
            <Skeleton
              key={`feature-skeleton-${index}`}
              className="h-[148px] rounded-[22px] bg-surface-elevated"
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
          <p className="font-['Hind_Siliguri'] text-sm font-semibold leading-6 text-text-primary">
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
      <div className="grid grid-cols-2 gap-3">
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
              <div className="pointer-events-none absolute inset-x-4 top-3 h-12 rounded-[18px] bg-secondary opacity-50 blur-2xl" />

              <CardVisual item={item} />

              <div className="relative z-10 mt-3 flex flex-1 flex-col items-center justify-center">
                <span
                  className="line-clamp-2 font-['Hind_Siliguri'] text-base font-bold leading-snug tracking-tight text-text-primary"
                  style={color ? { color } : undefined}
                >
                  {label}
                </span>
              </div>

              <div className="relative z-10 mt-3 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </div>
            </>
          );

          const baseClassName =
            'group relative flex min-h-[148px] flex-col items-center justify-center overflow-hidden rounded-[22px] border border-card-border bg-card-bg px-3 py-4 text-center transition-all duration-200 active:scale-[0.985]';

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
