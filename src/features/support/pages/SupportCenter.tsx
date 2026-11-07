import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LifeBuoy, Plus, Search } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import PullToRefresh from '@/features/groups/components/PullToRefresh';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import SupportTicketCard from '../components/SupportTicketCard';
import { useSupportTickets } from '../hooks/useSupportTickets';
import { FILTER_STATUSES } from '../utils/supportTickets';
import type { SupportStatus } from '../types/supportTypes';

type FilterValue = SupportStatus | 'all';

const PAGE_SIZE = 20;

const SupportCenter: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [filter, setFilter] = useState<FilterValue>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const params = useMemo(
    () => ({
      status: filter === 'all' ? undefined : filter,
      search: search || undefined,
      limit,
      offset: 0,
    }),
    [filter, search, limit]
  );

  const { data, isLoading, isError, refetch, isFetching } = useSupportTickets(params);

  const tickets = data?.items ?? [];
  const total = data?.total ?? 0;
  const canLoadMore = tickets.length < total;

  const applyFilter = (next: FilterValue) => {
    setFilter(next);
    setLimit(PAGE_SIZE);
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setSearch(searchInput.trim());
    setLimit(PAGE_SIZE);
  };

  return (
    <div className="flex min-h-screen flex-col bg-app font-['Hind_Siliguri'] text-text-primary">
      <header className="sticky top-0 z-30 border-b border-border-color bg-surface/90 backdrop-blur-md">
        <div className="flex items-center gap-3 p-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={t('common.back')}
            className="-ml-1 p-1 text-text-secondary transition-colors hover:text-text-primary"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-text-primary">{t('support.title')}</h1>
            <p className="text-xs text-text-secondary">{t('support.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/support/new')}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-bold text-primary-foreground active:scale-95"
          >
            <Plus size={16} aria-hidden="true" />
            {t('support.newTicket')}
          </button>
        </div>

        <form onSubmit={submitSearch} className="px-4 pb-3">
          <div className="flex items-center gap-2 rounded-xl border border-input-border bg-input-bg px-3 py-2">
            <Search size={16} className="shrink-0 text-text-secondary" aria-hidden="true" />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t('support.searchPlaceholder')}
              aria-label={t('support.searchPlaceholder')}
              className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
            />
            <button
              type="submit"
              className="shrink-0 rounded-lg bg-surface-elevated px-2.5 py-1 text-[11px] font-semibold text-text-primary"
            >
              {t('common.search')}
            </button>
          </div>
        </form>

        <div className="flex gap-2 overflow-x-auto px-4 pb-3">
          {FILTER_STATUSES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => applyFilter(option.value)}
              aria-pressed={filter === option.value}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                filter === option.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border-color bg-surface text-text-secondary'
              }`}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
      </header>

      <PullToRefresh
        onRefresh={async () => {
          await refetch();
        }}
      >
        <div className="flex-1 space-y-3 p-4">
          {isLoading &&
            Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-28 w-full rounded-2xl bg-surface" />
            ))}

          {isError && !isLoading && (
            <div className="rounded-2xl border border-card-border bg-card-bg p-6 text-center">
              <p className="text-sm text-text-secondary">{t('support.loadError')}</p>
              <button
                type="button"
                onClick={() => void refetch()}
                className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                {t('common.retry')}
              </button>
            </div>
          )}

          {!isLoading && !isError && tickets.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border-color bg-card-bg px-6 py-10 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <LifeBuoy size={26} aria-hidden="true" />
              </span>
              <p className="mt-4 text-base font-semibold text-text-primary">
                {search || filter !== 'all' ? t('support.noMatches') : t('support.empty')}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                {search || filter !== 'all'
                  ? t('support.noMatchesHint')
                  : t('support.emptyHint')}
              </p>
              <button
                type="button"
                onClick={() => navigate('/support/new')}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground active:scale-95"
              >
                <Plus size={16} aria-hidden="true" />
                {t('support.newTicket')}
              </button>
            </div>
          )}

          {tickets.map((ticket) => (
            <SupportTicketCard
              key={ticket.id}
              ticket={ticket}
              onOpen={(ticketId) => navigate(`/support/${ticketId}`)}
            />
          ))}

          {canLoadMore && (
            <button
              type="button"
              disabled={isFetching}
              onClick={() => setLimit((current) => current + PAGE_SIZE)}
              className="w-full rounded-xl border border-border-color bg-surface py-3 text-sm font-semibold text-text-primary disabled:opacity-50"
            >
              {isFetching ? t('common.loading') : t('support.loadMore')}
            </button>
          )}
        </div>
      </PullToRefresh>
    </div>
  );
};

export default SupportCenter;
