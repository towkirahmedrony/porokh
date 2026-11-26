import React, { memo } from 'react';
import { ListFilter } from 'lucide-react';

import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import { formatCount } from '@/shared/lib/attemptFormat';

interface Props {
  count: number;
  showCount: boolean;
  filterCount: number;
  isOpen: boolean;
  onToggleFilters: () => void;
}

/**
 * The Mistakes toolbar carries only the result count and the filter button with
 * its active count. Search, sort and every facet live inside the panel, so the
 * row keeps one clear action.
 */
export const ExplorerToolbar: React.FC<Props> = memo(
  ({ count, showCount, filterCount, isOpen, onToggleFilters }) => {
    const { language, t } = useLanguage();

    return (
      <div className="flex items-center justify-between gap-2">
        <p
          className="min-w-0 truncate text-[12px] leading-5 text-text-secondary"
          aria-live="polite"
        >
          {showCount
            ? t('history.explorerListCount', { count: formatCount(count, language) })
            : ''}
        </p>

        <button
          type="button"
          onClick={onToggleFilters}
          aria-expanded={isOpen}
          aria-controls="explorer-filters"
          aria-label={
            filterCount > 0
              ? t('history.explorerFilterAriaActive', {
                  count: localizeDigits(filterCount, language),
                })
              : t('history.explorerFilterAria')
          }
          className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
            isOpen
              ? 'bg-surface-elevated text-text-primary'
              : 'bg-card-bg text-text-primary'
          }`}
        >
          <ListFilter className="h-[18px] w-[18px]" aria-hidden="true" />
          {filterCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {localizeDigits(filterCount, language)}
            </span>
          ) : null}
        </button>
      </div>
    );
  }
);

ExplorerToolbar.displayName = 'ExplorerToolbar';
