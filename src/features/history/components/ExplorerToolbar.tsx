import React, { memo } from 'react';
import { Eye, EyeOff, ListFilter, Search, SlidersHorizontal, X } from 'lucide-react';

import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import type { ExplorerFilters } from '../types/explorer';

interface Props {
  searchOpen: boolean;
  searchQuery: string;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
  onSearchChange: (value: string) => void;
  revealAll: boolean;
  onToggleReveal: () => void;
  filterCount: number;
  onOpenFilters: () => void;
  onOpenPractice: () => void;
  activeChips: { key: keyof ExplorerFilters; label: string }[];
  onRemoveChip: (key: keyof ExplorerFilters) => void;
}

const ICON_BUTTON =
  'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-card-bg text-text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-40';

/**
 * Four controls, one row: search, filter, answer visibility, practice. Each is
 * a 44px target and every state is also announced, so a screen reader hears the
 * same thing the icon shows.
 */
export const ExplorerToolbar: React.FC<Props> = memo(
  ({
    searchOpen,
    searchQuery,
    onOpenSearch,
    onCloseSearch,
    onSearchChange,
    revealAll,
    onToggleReveal,
    filterCount,
    onOpenFilters,
    onOpenPractice,
    activeChips,
    onRemoveChip,
  }) => {
    const { language, t } = useLanguage();

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {searchOpen ? (
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
                aria-hidden="true"
              />
              <input
                type="search"
                autoFocus
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                aria-label={t('history.explorerSearchLabel')}
                placeholder={t('history.explorerSearchPlaceholder')}
                className="h-11 w-full rounded-xl bg-card-bg pl-9 pr-11 text-[13px] text-text-primary placeholder:text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring [&::-webkit-search-cancel-button]:hidden"
              />
              <button
                type="button"
                onClick={onCloseSearch}
                aria-label={t('history.explorerCloseSearch')}
                className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-xl text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <>
              <span className="min-w-0 flex-1 truncate text-[12px] leading-5 text-text-secondary">
                {activeChips.length > 0 ? t('history.explorerFilteredHint') : ''}
              </span>
              <button
                type="button"
                onClick={onOpenSearch}
                aria-label={t('history.explorerSearchLabel')}
                className={ICON_BUTTON}
              >
                <Search className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onOpenFilters}
            aria-haspopup="dialog"
            aria-label={
              filterCount > 0
                ? t('history.explorerFilterAriaActive', {
                    count: localizeDigits(filterCount, language),
                  })
                : t('history.explorerFilterAria')
            }
            className={ICON_BUTTON}
          >
            <ListFilter className="h-[18px] w-[18px]" aria-hidden="true" />
            {filterCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {localizeDigits(filterCount, language)}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={onToggleReveal}
            aria-pressed={revealAll}
            aria-label={
              revealAll ? t('history.explorerHideAllAnswers') : t('history.explorerRevealAllAnswers')
            }
            className={ICON_BUTTON}
          >
            {revealAll ? (
              <EyeOff className="h-[18px] w-[18px]" aria-hidden="true" />
            ) : (
              <Eye className="h-[18px] w-[18px]" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={onOpenPractice}
            aria-haspopup="dialog"
            aria-label={t('history.explorerPracticeAria')}
            className={ICON_BUTTON}
          >
            <SlidersHorizontal className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </div>

        {activeChips.length > 0 && !searchOpen ? (
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5" aria-label={t('history.explorerActiveFilters')}>
            {activeChips.map((chip) => (
              <span
                key={chip.key}
                className="flex shrink-0 items-center gap-1 rounded-lg border border-border-color bg-card-bg py-1 pl-2.5 pr-1 text-[11px] leading-5 text-text-primary"
              >
                {chip.label}
                <button
                  type="button"
                  onClick={() => onRemoveChip(chip.key)}
                  aria-label={t('history.explorerRemoveFilter', { label: chip.label })}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  }
);

ExplorerToolbar.displayName = 'ExplorerToolbar';
