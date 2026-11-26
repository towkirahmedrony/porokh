import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Filter, RotateCcw, Search, X } from 'lucide-react';

import { useLanguage } from '@/shared/i18n/LanguageProvider';

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Lists longer than this get a search field inside the dropdown. */
  searchThreshold?: number;
}

const OPTION_CLASS =
  'flex min-h-[44px] w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] leading-5 text-text-primary transition-colors hover:bg-surface focus:outline-none focus-visible:bg-surface-elevated';

/**
 * A labelled dropdown that stays readable inside a narrow two-column grid: the
 * trigger truncates, the open list wraps long Bangla and English values, and a
 * long list carries its own search so a topic or institution is reachable
 * without scrolling through hundreds of rows.
 */
export const FilterSelect: React.FC<FilterSelectProps> = memo(
  ({ label, value, options, onChange, disabled = false, searchThreshold = 8 }) => {
    const { t } = useLanguage();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');

    const rootRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const searchRef = useRef<HTMLInputElement | null>(null);

    const selected = useMemo(
      () => options.find((option) => option.value === value) ?? options[0],
      [options, value]
    );

    const searchable = options.length > searchThreshold;

    const filtered = useMemo(() => {
      const needle = query.trim().toLowerCase();
      if (!needle) return options;
      return options.filter((option) => option.label.toLowerCase().includes(needle));
    }, [options, query]);

    useEffect(() => {
      if (!open) {
        setQuery('');
        return;
      }

      const onPointerDown = (event: MouseEvent | TouchEvent) => {
        const root = rootRef.current;
        if (root && !root.contains(event.target as Node)) setOpen(false);
      };

      document.addEventListener('mousedown', onPointerDown);
      document.addEventListener('touchstart', onPointerDown);
      return () => {
        document.removeEventListener('mousedown', onPointerDown);
        document.removeEventListener('touchstart', onPointerDown);
      };
    }, [open]);

    useEffect(() => {
      if (!open) return;
      if (searchable) searchRef.current?.focus();
    }, [open, searchable]);

    const close = (returnFocus = false) => {
      setOpen(false);
      if (returnFocus) triggerRef.current?.focus();
    };

    return (
      <div ref={rootRef} className="relative min-w-0">
        <span className="ml-1 block text-[11px] font-medium leading-4 text-text-secondary">
          {label}
        </span>

        <button
          ref={triggerRef}
          type="button"
          aria-expanded={open}
          aria-label={`${label}: ${selected?.label ?? ''}`}
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && open) close(true);
          }}
          className="mt-1 flex h-11 w-full min-w-0 items-center gap-1.5 rounded-xl border border-input-border bg-input-bg px-2 text-left text-[13px] text-text-primary outline-none transition focus:border-transparent focus:ring-2 focus:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="min-w-0 flex-1 truncate">{selected?.label ?? ''}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-text-secondary transition-transform ${
              open ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </button>

        {open ? (
          <div
            className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-xl border border-border-color bg-card-bg shadow-lg"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                close(true);
              }
            }}
          >
            {searchable ? (
              <div className="border-b border-border-color p-2">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-secondary"
                    aria-hidden="true"
                  />
                  <input
                    ref={searchRef}
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    aria-label={`${label}: ${t('common.search')}`}
                    placeholder={t('common.search')}
                    className="h-9 w-full rounded-lg border border-input-border bg-surface pl-8 pr-2 text-[12px] text-text-primary placeholder:text-text-secondary focus:border-transparent focus:outline-none focus:ring-2 focus:ring-focus-ring [&::-webkit-search-cancel-button]:hidden"
                  />
                </div>
              </div>
            ) : null}

            <div role="group" aria-label={label} className="max-h-60 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <p className="px-3 py-2 text-[12px] leading-5 text-text-secondary">
                  {t('common.noOptions')}
                </p>
              ) : (
                filtered.map((option) => {
                  const isSelected = option.value === value;
                  return (
                    <button
                      key={option.value || 'all'}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        onChange(option.value);
                        close(true);
                      }}
                      className={`${OPTION_CLASS} ${isSelected ? 'font-semibold' : ''}`}
                    >
                      <span className="min-w-0 flex-1 break-words">{option.label}</span>
                      {isSelected ? (
                        <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : null}
      </div>
    );
  }
);

FilterSelect.displayName = 'FilterSelect';

export interface FilterPanelSearch {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
}

interface FilterPanelProps {
  id?: string;
  title: string;
  resetLabel: string;
  onReset: () => void;
  search?: FilterPanelSearch;
  /** Label and inputs: the page decides which dropdowns it needs. */
  children: React.ReactNode;
  /** Sections below the grid, such as quick filters or type chips. */
  extra?: React.ReactNode;
  /** Action rows at the bottom of the panel. */
  footer?: React.ReactNode;
  gridClassName?: string;
}

/**
 * The one filter shell used by the Mistakes tab and the Question Bank. It owns
 * only the frame (title, reset, search, field grid and slots); every dropdown
 * and every page-specific section is passed in, so the two pages cannot drift
 * apart visually while keeping their own filters.
 */
export const FilterPanel: React.FC<FilterPanelProps> = ({
  id,
  title,
  resetLabel,
  onReset,
  search,
  children,
  extra,
  footer,
  gridClassName = 'grid grid-cols-2 gap-3',
}) => {
  const { t } = useLanguage();
  const hasSearch = Boolean(search?.value);

  return (
    <div
      id={id}
      className="rounded-3xl border border-card-border bg-card-bg p-4 shadow-sm"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="rounded-xl bg-secondary p-2 text-text-primary">
            <Filter className="h-4 w-4" aria-hidden="true" />
          </div>
          <h3 className="min-w-0 truncate text-sm font-semibold text-text-primary">{title}</h3>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          {resetLabel}
        </button>
      </div>

      <div className="space-y-4">
        {search ? (
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search.value}
              onChange={(event) => search.onChange(event.target.value)}
              aria-label={search.label}
              placeholder={search.placeholder}
              className="h-11 w-full rounded-xl border border-input-border bg-input-bg pl-9 pr-11 text-sm text-text-primary placeholder:text-text-secondary focus:border-transparent focus:outline-none focus:ring-2 focus:ring-focus-ring [&::-webkit-search-cancel-button]:hidden"
            />
            {hasSearch ? (
              <button
                type="button"
                onClick={() => search.onChange('')}
                aria-label={t('common.clearSearch')}
                className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-xl text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ) : null}

        <div className={gridClassName}>{children}</div>

        {extra}
      </div>

      {footer}
    </div>
  );
};

export default FilterPanel;
