import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Search, Shield, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import { GroupShieldTile } from '../components/GroupShieldTile';
import { PullToRefresh } from '../components/PullToRefresh';
import { useDiscoverGroups, useMyGroups, GROUP_QUERY_KEYS } from '../hooks/useGroupQueries';
import { groupsService } from '../services/groupsService';
import { resolveGroupErrorMessage } from '../utils/errorMessages';
import type { Group, GroupType } from '../types';

type MyGroupEntry = {
  key: string;
  group: Group;
  pending: boolean;
};

const GroupsHub: React.FC = () => {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();

  const [code, setCode] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [type, setType] = useState<GroupType | undefined>(undefined);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => window.clearTimeout(timer);
  }, [search]);

  const myGroups = useMyGroups();
  const discover = useDiscoverGroups({ type, q: debouncedSearch || undefined, page: 1 });

  const joinByCodeMutation = useMutation({
    mutationFn: () => groupsService.joinByCode(code.trim().toUpperCase()),
    onSuccess: (result) => {
      setCode('');
      void queryClient.invalidateQueries({ queryKey: GROUP_QUERY_KEYS.me() });
      void queryClient.invalidateQueries({ queryKey: GROUP_QUERY_KEYS.all });
      toast.success(
        result.result === 'pending' ? t('groups.pendingSuccess') : t('groups.joinSuccess')
      );
    },
    onError: (error) => toast.error(resolveGroupErrorMessage(error, language)),
  });

  const joinMutation = useMutation({
    mutationFn: (groupId: string) => groupsService.joinGroup(groupId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: GROUP_QUERY_KEYS.me() });
      void queryClient.invalidateQueries({ queryKey: GROUP_QUERY_KEYS.all });
      toast.success(
        result.result === 'pending' ? t('groups.pendingSuccess') : t('groups.joinSuccess')
      );
    },
    onError: (error) => toast.error(resolveGroupErrorMessage(error, language)),
  });

  const refreshAll = async () => {
    await Promise.all([myGroups.refetch(), discover.refetch()]);
  };

  const squad = myGroups.data?.squad ?? null;
  const communities = myGroups.data?.communities ?? [];
  const pending = myGroups.data?.pending ?? [];

  const myGroupEntries = useMemo<MyGroupEntry[]>(() => {
    const entries: MyGroupEntry[] = [];
    const seen = new Set<string>();

    if (squad?.group) {
      entries.push({
        key: squad.id,
        group: squad.group,
        pending: squad.status !== 'active',
      });
      seen.add(squad.group.id);
    }

    for (const membership of communities) {
      if (!membership.group || seen.has(membership.group.id)) continue;
      entries.push({
        key: membership.id,
        group: membership.group,
        pending: membership.status !== 'active',
      });
      seen.add(membership.group.id);
    }

    for (const membership of pending) {
      const groupId = membership.group?.id ?? membership.group_id;
      if (seen.has(groupId)) continue;
      entries.push({
        key: membership.id,
        group: membership.group ?? {
          id: membership.group_id,
          slug: membership.group_id,
          name: membership.group_id,
          icon: null,
          description: null,
          group_type: 'community',
          max_members: 0,
          visibility: 'code',
          member_count: 0,
          total_xp: 0,
          group_level: 1,
          current_streak: 0,
          last_activity_date: null,
          is_active: true,
          created_by: '',
          created_at: '',
          updated_at: '',
        },
        pending: true,
      });
      seen.add(groupId);
    }

    return entries;
  }, [squad, communities, pending]);

  const myGroupIds = useMemo(
    () =>
      new Set(
        (myGroups.data?.memberships ?? [])
          .filter((row) => ['active', 'pending', 'invited'].includes(row.status))
          .map((row) => row.group_id)
      ),
    [myGroups.data?.memberships]
  );

  const discoverItems = useMemo(
    () => (discover.data?.items ?? []).filter((group) => !myGroupIds.has(group.id)),
    [discover.data?.items, myGroupIds]
  );

  const groupTypeLabel = (groupType: GroupType) =>
    groupType === 'squad' ? t('groups.filterSquads') : t('groups.filterCommunities');

  return (
    <PullToRefresh onRefresh={refreshAll}>
      <div className="-m-4 min-h-[calc(100vh-4rem)] bg-grp-bg px-4 pt-5 pb-28 text-grp-text font-hind-bangla md:-m-6 md:px-6 md:pt-6 md:pb-10">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Title Row */}
          <header className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-[26px] font-bold leading-tight text-grp-text">
                {t('groups.title')}
              </h1>
              <p className="mt-0.5 text-[13px] leading-snug text-grp-muted">
                {t('groups.subtitle')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/groups/leaderboard')}
              aria-label={t('groups.leaderboard')}
              title={t('groups.leaderboard')}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-grp-primary-tint text-grp-primary transition-colors hover:bg-grp-primary hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-grp-primary"
            >
              <Trophy className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            </button>
          </header>

          {/* Join Code Block */}
          <section className="rounded-2xl bg-grp-surface-tint p-3">
            <form
              className="flex items-center gap-2.5"
              onSubmit={(event) => {
                event.preventDefault();
                if (code.trim().length < 4 || joinByCodeMutation.isPending) return;
                joinByCodeMutation.mutate();
              }}
            >
              <label htmlFor="group-join-code-input" className="sr-only">
                {t('groups.joinWithCode')}
              </label>
              <input
                id="group-join-code-input"
                type="text"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase().slice(0, 8))}
                placeholder={t('groups.codePlaceholder')}
                maxLength={8}
                autoCapitalize="characters"
                className="min-h-[44px] min-w-0 flex-1 rounded-xl bg-grp-bg px-3.5 text-[15px] text-grp-text placeholder:text-grp-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-grp-primary"
              />
              <button
                type="submit"
                disabled={joinByCodeMutation.isPending}
                className="min-h-[44px] shrink-0 whitespace-nowrap rounded-xl bg-grp-primary px-5 text-[15px] font-semibold text-white transition-colors hover:bg-grp-primary-dark disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-grp-primary focus-visible:ring-offset-2"
              >
                {joinByCodeMutation.isPending ? t('common.loading') : t('groups.joinAction')}
              </button>
            </form>
          </section>

          {/* My Groups (Combined Squads & Communities) */}
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-[17px] font-bold leading-snug text-grp-text">
                  {t('groups.myGroups')}
                </h2>
                {myGroups.isFetching && !myGroups.isLoading && (
                  <RefreshCw className="h-4 w-4 animate-spin text-grp-muted" aria-hidden="true" />
                )}
              </div>

              {!myGroups.isLoading && (squad || myGroupEntries.length > 0) && (
                <button
                  type="button"
                  onClick={() => navigate('/groups/new')}
                  className="inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-lg px-1 text-[13px] font-semibold text-grp-primary transition-colors hover:text-grp-primary-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-grp-primary"
                >
                  {t('groups.createSquad')}
                </button>
              )}
            </div>

            {myGroups.isLoading ? (
              <div className="space-y-2 py-2">
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ) : myGroupEntries.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-grp-primary-tint text-grp-primary"
                  aria-hidden="true"
                >
                  <Shield className="h-6 w-6" strokeWidth={2} />
                </div>
                <p className="mt-3 text-[16px] font-bold text-grp-text">
                  {t('groups.noGroups')}
                </p>
                <p className="mt-1 text-[13px] leading-snug text-grp-muted">
                  {t('groups.noGroupsHint')}
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/groups/new')}
                  className="mt-4 min-h-[44px] whitespace-nowrap rounded-xl bg-grp-primary px-6 text-[15px] font-semibold text-white transition-colors hover:bg-grp-primary-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-grp-primary focus-visible:ring-offset-2"
                >
                  {t('groups.createSquad')}
                </button>
              </div>
            ) : (
              <div className="divide-y divide-grp-hairline">
                {myGroupEntries.map(({ key, group, pending: isPending }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => navigate(`/groups/${group.slug ?? group.id}`)}
                    className="flex min-h-[64px] w-full items-center gap-3 py-3 text-left transition-colors hover:bg-grp-surface-tint/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-grp-primary rounded-lg"
                  >
                    <GroupShieldTile size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold leading-snug text-grp-text">
                        {group.name}
                      </p>
                      <p className="mt-0.5 truncate text-[13px] leading-snug text-grp-muted tabular-nums">
                        {groupTypeLabel(group.group_type)} ·{' '}
                        {localizeDigits(group.member_count, language)}/
                        {localizeDigits(group.max_members, language)} {t('groups.members')}
                        {isPending ? ` · ${t('groups.pending')}` : ''}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Discover Section */}
          <section className="border-t border-grp-hairline pt-2">
            {/* Underline Tabs */}
            <div
              role="tablist"
              aria-label={t('groups.discover')}
              className="flex items-center gap-6 border-b border-grp-hairline"
            >
              {[
                { value: undefined, label: t('groups.filterAll') },
                { value: 'squad' as const, label: t('groups.filterSquads') },
                { value: 'community' as const, label: t('groups.filterCommunities') },
              ].map((option) => {
                const active = type === option.value;
                return (
                  <button
                    key={option.label}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setType(option.value)}
                    className={`relative min-h-[44px] whitespace-nowrap px-0.5 text-[15px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-grp-primary ${
                      active
                        ? 'font-bold text-grp-primary'
                        : 'font-medium text-grp-muted hover:text-grp-text'
                    }`}
                  >
                    {option.label}
                    {active && (
                      <span
                        className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-grp-primary"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Search Field */}
            <div className="mt-4">
              <label htmlFor="group-search-input" className="sr-only">
                {t('groups.searchPlaceholder')}
              </label>
              <div className="flex min-h-[44px] items-center gap-2.5 rounded-2xl bg-grp-surface-tint px-3.5">
                <Search className="h-4 w-4 shrink-0 text-grp-muted" strokeWidth={2} aria-hidden="true" />
                <input
                  id="group-search-input"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('groups.searchPlaceholder')}
                  className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] text-grp-text placeholder:text-grp-muted focus:outline-none"
                />
              </div>
            </div>

            {/* Results List */}
            <div className="mt-2">
              {discover.isLoading ? (
                <div className="space-y-3 py-3">
                  <Skeleton className="h-14 w-full rounded-xl" />
                  <Skeleton className="h-14 w-full rounded-xl" />
                </div>
              ) : discover.isError ? (
                <div className="py-8 text-center">
                  <p className="mb-3 text-[14px] text-grp-muted">
                    {resolveGroupErrorMessage(discover.error, language)}
                  </p>
                  <button
                    type="button"
                    onClick={() => void discover.refetch()}
                    className="min-h-[44px] rounded-xl border border-grp-primary/40 px-4 text-[14px] font-semibold text-grp-primary hover:bg-grp-primary-tint"
                  >
                    {t('groups.retry')}
                  </button>
                </div>
              ) : discoverItems.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-[15px] text-grp-muted">{t('groups.noResults')}</p>
                </div>
              ) : (
                <div className="divide-y divide-grp-hairline">
                  {discoverItems.map((group) => {
                    const isFull = group.member_count >= group.max_members;
                    const actionText = isFull
                      ? t('groups.full')
                      : group.visibility === 'approval'
                        ? t('groups.requestAction')
                        : t('groups.joinAction');

                    return (
                      <div key={group.id} className="flex items-center gap-3 py-3">
                        <button
                          type="button"
                          onClick={() => navigate(`/groups/${group.slug ?? group.id}`)}
                          className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-grp-primary"
                        >
                          <GroupShieldTile size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-bold leading-snug text-grp-text">
                              {group.name}
                            </p>
                            <p className="mt-0.5 truncate text-[13px] leading-snug text-grp-muted tabular-nums">
                              {groupTypeLabel(group.group_type)} ·{' '}
                              {localizeDigits(group.member_count, language)}/
                              {localizeDigits(group.max_members, language)} {t('groups.members')}
                            </p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => joinMutation.mutate(group.id)}
                          disabled={isFull || joinMutation.isPending}
                          className="min-h-[44px] shrink-0 whitespace-nowrap rounded-xl border border-grp-primary/40 px-4 text-[14px] font-semibold text-grp-primary transition-colors hover:bg-grp-primary-tint disabled:border-grp-hairline disabled:text-grp-muted disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-grp-primary"
                        >
                          {actionText}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </PullToRefresh>
  );
};

export default GroupsHub;
