import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Trophy } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import { GroupShieldTile } from '../components/GroupShieldTile';
import { PullToRefresh } from '../components/PullToRefresh';
import { useGroupLeaderboard, useMyGroups } from '../hooks/useGroupQueries';
import { resolveGroupErrorMessage } from '../utils/errorMessages';
import type { GroupLeaderboardRow, LeaderboardPeriod } from '../types';

const PERIODS: Array<{
  value: LeaderboardPeriod;
  key: 'groups.weekly' | 'groups.monthly' | 'groups.allTime';
}> = [
  { value: 'weekly', key: 'groups.weekly' },
  { value: 'monthly', key: 'groups.monthly' },
  { value: 'all_time', key: 'groups.allTime' },
];

const GroupLeaderboard: React.FC = () => {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const [period, setPeriod] = useState<LeaderboardPeriod>('weekly');
  const leaderboard = useGroupLeaderboard(period);
  const myGroups = useMyGroups();

  const rows = leaderboard.data?.pages.flatMap((page) => page.items) ?? [];
  const topThree = rows.slice(0, 3);
  const restRows = rows.slice(3);

  const myRow = rows.find((row) => row.is_my_group) ?? null;
  const myRowRef = useRef<HTMLButtonElement | null>(null);
  const [isMyRowVisible, setIsMyRowVisible] = useState(false);

  useEffect(() => {
    const node = myRowRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setIsMyRowVisible(false);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        setIsMyRowVisible(entries[0]?.isIntersecting ?? false);
      },
      { threshold: 0.2 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [myRow?.group_id, period, rows.length]);

  const myFallbackGroup =
    myGroups.data?.squad?.group ??
    myGroups.data?.communities.find((m) => m.group)?.group ??
    null;

  // Pin "আপনার গ্রুপ" above the bottom nav when the user has a group that is
  // either outside the loaded list or scrolled out of the visible viewport.
  const myRowInTopThree = Boolean(myRow && topThree.some((r) => r.group_id === myRow.group_id));
  const showPinnedMyGroup =
    !leaderboard.isLoading &&
    !leaderboard.isError &&
    rows.length > 0 &&
    ((Boolean(myRow) && !myRowInTopThree && !isMyRowVisible) ||
      (!myRow && Boolean(myFallbackGroup)));

  const pinnedGroupName = myRow?.group?.name ?? myFallbackGroup?.name ?? '';
  const pinnedGroupTarget =
    myRow?.group?.slug ??
    myRow?.group_id ??
    myFallbackGroup?.slug ??
    myFallbackGroup?.id ??
    '';
  const pinnedRankText = myRow ? localizeDigits(myRow.rank, language) : '—';
  const pinnedXpText = myRow
    ? localizeDigits(Math.round(myRow.avg_xp), language)
    : localizeDigits(0, language);

  const openGroup = (row: GroupLeaderboardRow) => {
    if (!row.group) return;
    navigate(`/groups/${row.group.slug ?? row.group_id}`);
  };

  const podiumSlots =
    topThree.length >= 3
      ? [
          { row: topThree[1], isFirst: false },
          { row: topThree[0], isFirst: true },
          { row: topThree[2], isFirst: false },
        ]
      : topThree.length === 2
        ? [
            { row: topThree[1], isFirst: false },
            { row: topThree[0], isFirst: true },
          ]
        : topThree.length === 1
          ? [{ row: topThree[0], isFirst: true }]
          : [];

  return (
    <PullToRefresh onRefresh={() => leaderboard.refetch()}>
      <div className="-m-4 min-h-[calc(100vh-4rem)] bg-grp-bg px-4 pt-2 pb-32 text-grp-text font-hind-bangla md:-m-6 md:px-6 md:pt-6 md:pb-20">
        <div className="mx-auto max-w-2xl space-y-2.5">
          {/* Back + Title */}
          <header className="-ml-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigate('/groups')}
              aria-label={t('groups.title')}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-grp-text transition-colors hover:bg-grp-surface-tint focus:outline-none focus-visible:ring-2 focus-visible:ring-grp-primary"
            >
              <ChevronLeft className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
            </button>
            <h1 className="min-w-0 truncate text-[20px] font-bold leading-tight text-grp-text">
              {t('groups.leaderboard')}
            </h1>
          </header>

          {/* Segmented control */}
          <div
            role="tablist"
            aria-label={t('groups.leaderboard')}
            className="flex items-center rounded-full bg-grp-surface-tint p-0.5"
          >
            {PERIODS.map((option) => {
              const active = period === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setPeriod(option.value)}
                  className={`min-h-[40px] flex-1 whitespace-nowrap rounded-full px-3 text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-grp-primary ${
                    active
                      ? 'bg-grp-primary font-semibold text-white'
                      : 'font-medium text-grp-muted hover:text-grp-text'
                  }`}
                >
                  {t(option.key)}
                </button>
              );
            })}
          </div>

          <p className="text-[12px] text-grp-muted">{t('groups.avgXp')}</p>

          {leaderboard.isLoading ? (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-3 gap-3 pb-4">
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-28 rounded-2xl" />
                <Skeleton className="h-24 rounded-2xl" />
              </div>
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : leaderboard.isError ? (
            <div className="py-10 text-center">
              <p className="mb-4 text-[14px] text-grp-muted">
                {resolveGroupErrorMessage(leaderboard.error, language)}
              </p>
              <button
                type="button"
                onClick={() => void leaderboard.refetch()}
                className="min-h-[44px] rounded-xl border border-grp-primary/40 px-5 text-[14px] font-semibold text-grp-primary hover:bg-grp-primary-tint"
              >
                {t('groups.retry')}
              </button>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full bg-grp-primary-tint text-grp-primary"
                aria-hidden="true"
              >
                <Trophy className="h-6 w-6" strokeWidth={2} />
              </div>
              <p className="mt-3 text-[16px] font-bold text-grp-text">
                {t('groups.noResults')}
              </p>
              <button
                type="button"
                onClick={() => navigate('/groups')}
                className="mt-4 min-h-[44px] whitespace-nowrap rounded-xl bg-grp-primary px-6 text-[15px] font-semibold text-white transition-colors hover:bg-grp-primary-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-grp-primary focus-visible:ring-offset-2"
              >
                {t('groups.goToGroups')}
              </button>
            </div>
          ) : (
            <>
              {/* Top 3 Podium */}
              {podiumSlots.length > 0 && (
                <div
                  className={`grid items-end gap-2 border-b border-grp-hairline pt-1 pb-4 ${
                    podiumSlots.length === 3
                      ? 'grid-cols-3'
                      : podiumSlots.length === 2
                        ? 'grid-cols-2'
                        : 'grid-cols-1'
                  }`}
                >
                  {podiumSlots.map(({ row, isFirst }) => (
                    <button
                      key={`${row.group_id}-${row.period_type}`}
                      type="button"
                      onClick={() => openGroup(row)}
                      className={`flex min-h-[44px] min-w-0 flex-col items-center rounded-xl p-1 text-center transition-opacity hover:opacity-85 focus:outline-none focus-visible:ring-2 focus-visible:ring-grp-primary ${
                        isFirst ? '' : 'pt-3'
                      }`}
                    >
                      <GroupShieldTile
                        size={isFirst ? 'lg' : 'md'}
                        tone={isFirst ? 'gold' : 'tint'}
                      />
                      <p className="mt-1.5 w-full truncate text-[13px] font-bold leading-snug text-grp-text">
                        {row.group?.name ?? 'Group'}
                      </p>
                      <p className="mt-0.5 text-[12px] text-grp-muted tabular-nums">
                        {localizeDigits(Math.round(row.avg_xp), language)} {t('groups.xp')}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {/* Ranks 4+ */}
              {restRows.length > 0 && (
                <div className="divide-y divide-grp-hairline">
                  {restRows.map((row) => {
                    const groupTypeLabel =
                      row.group?.group_type === 'community'
                        ? t('groups.filterCommunities')
                        : t('groups.filterSquads');

                    return (
                      <button
                        key={`${row.group_id}-${row.period_type}`}
                        ref={row.is_my_group ? myRowRef : undefined}
                        type="button"
                        onClick={() => openGroup(row)}
                        className="flex min-h-[52px] w-full items-center gap-3 rounded-lg py-1.5 text-left transition-colors hover:bg-grp-surface-tint/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-grp-primary"
                      >
                        <span className="w-6 shrink-0 text-center text-[15px] font-bold text-grp-muted tabular-nums">
                          {localizeDigits(row.rank, language)}
                        </span>
                        <GroupShieldTile size="sm" tone={row.is_my_group ? 'solid' : 'tint'} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-bold leading-snug text-grp-text">
                            {row.group?.name ?? 'Group'}
                          </p>
                          <p className="mt-0.5 truncate text-[13px] leading-snug text-grp-muted tabular-nums">
                            {groupTypeLabel} · {localizeDigits(row.member_count, language)}{' '}
                            {t('groups.members')}
                          </p>
                        </div>
                        <span className="shrink-0 text-right text-[15px] font-bold text-grp-text tabular-nums">
                          {localizeDigits(Math.round(row.avg_xp), language)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {leaderboard.hasNextPage && (
                <button
                  type="button"
                  disabled={leaderboard.isFetchingNextPage}
                  onClick={() => void leaderboard.fetchNextPage()}
                  className="mt-2 min-h-[44px] w-full rounded-xl border border-grp-hairline px-4 text-[14px] font-semibold text-grp-primary transition-colors hover:bg-grp-surface-tint disabled:opacity-50"
                >
                  {leaderboard.isFetchingNextPage ? t('common.loading') : t('groups.loadMore')}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Pinned "আপনার গ্রুপ" bar above BottomNav */}
      {showPinnedMyGroup && (
        <div className="fixed bottom-20 left-0 right-0 z-30 border-t border-grp-hairline bg-grp-primary-tint px-4 py-1.5 font-hind-bangla md:bottom-0 md:left-64">
          <button
            type="button"
            onClick={() => pinnedGroupTarget && navigate(`/groups/${pinnedGroupTarget}`)}
            className="mx-auto flex min-h-[44px] w-full max-w-2xl items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-grp-primary rounded-lg"
          >
            <span className="w-6 shrink-0 text-center text-[15px] font-bold text-grp-primary tabular-nums">
              {pinnedRankText}
            </span>
            <GroupShieldTile size="sm" tone="solid" />
            <p className="min-w-0 flex-1 truncate text-[15px] text-grp-text">
              <span className="font-bold">{pinnedGroupName}</span>
              <span className="text-grp-muted"> · {t('groups.yourGroup')}</span>
            </p>
            <span className="shrink-0 text-right text-[15px] font-bold text-grp-primary tabular-nums">
              {pinnedXpText}
            </span>
          </button>
        </div>
      )}
    </PullToRefresh>
  );
};

export default GroupLeaderboard;
