import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  LogOut,
  MoreVertical,
  RefreshCw,
  Settings,
  Share2,
  Swords,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import ConfirmModal from '@/shared/components/feedback/ConfirmModal';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import { GroupShieldTile } from '../components/GroupShieldTile';
import { GroupChat } from '../components/GroupChat';
import { MemberRow } from '../components/MemberRow';
import { BattleCreateForm } from '../components/BattleCreateForm';
import { BattleList } from '../components/BattleList';
import { PullToRefresh } from '../components/PullToRefresh';
import {
  useGroupBattles,
  useGroupDetail,
  useGroupsConfig,
  GROUP_QUERY_KEYS,
} from '../hooks/useGroupQueries';
import { groupsService } from '../services/groupsService';
import { resolveGroupErrorMessage } from '../utils/errorMessages';
import { serverOffsetMs } from '../utils/battleState';
import { groupShareUrl, isGroupUuid } from '../utils/groupSlug';

type Tab = 'overview' | 'members' | 'chat' | 'battles' | 'settings';

const TABS: Tab[] = ['overview', 'members', 'chat', 'battles'];

const isTab = (value: string | null): value is Tab =>
  value === 'overview' ||
  value === 'members' ||
  value === 'chat' ||
  value === 'battles' ||
  value === 'settings';

const GroupDetail: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const tab: Tab = isTab(rawTab) ? rawTab : 'overview';

  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState(() =>
    (searchParams.get('code') ?? '').toUpperCase()
  );
  const [showBattleForm, setShowBattleForm] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [icon, setIcon] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'code' | 'approval'>('code');
  const [maxMembers, setMaxMembers] = useState(2);

  const detail = useGroupDetail(groupId);
  const battles = useGroupBattles(groupId);
  const { data: config } = useGroupsConfig();

  const group = detail.data?.group;
  const isAdmin = detail.data?.isAdmin ?? false;
  const isOwner = detail.data?.isOwner ?? false;
  const isMember = detail.data?.isActiveMember ?? false;
  const membershipStatus = detail.data?.myMembership?.status;
  const isPending =
    membershipStatus === 'pending' || membershipStatus === 'invited';

  const joinCodeQuery = useQuery({
    queryKey: [...GROUP_QUERY_KEYS.detail(groupId ?? ''), 'join-code'],
    queryFn: () => groupsService.getJoinCode(groupId as string),
    enabled: Boolean(groupId) && isOwner,
    staleTime: 1000 * 60 * 5,
  });

  const activeJoinCode = joinCode ?? joinCodeQuery.data?.joinCode ?? null;

  useEffect(() => {
    setNowMs(Date.now() + serverOffsetMs(battles.data?.serverNow));
    const timer = window.setInterval(() => {
      setNowMs(Date.now() + serverOffsetMs(battles.data?.serverNow));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [battles.data?.serverNow]);

  useEffect(() => {
    if (!group) return;
    setName(group.name);
    setSlug(group.slug ?? '');
    setIcon(group.icon ?? '');
    setDescription(group.description ?? '');
    setVisibility(group.visibility);
    setMaxMembers(group.max_members);
  }, [group]);

  useEffect(() => {
    if (!group?.slug || !groupId || groupId === group.slug) return;
    if (!isGroupUuid(groupId) && groupId.toLowerCase() === group.slug.toLowerCase()) {
      const suffix = searchParams.toString();
      navigate(`/groups/${group.slug}${suffix ? `?${suffix}` : ''}`, { replace: true });
      return;
    }
    if (isGroupUuid(groupId)) {
      const suffix = searchParams.toString();
      navigate(`/groups/${group.slug}${suffix ? `?${suffix}` : ''}`, { replace: true });
    }
  }, [group?.slug, groupId, navigate, searchParams]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  const requests = useQuery({
    queryKey: [...GROUP_QUERY_KEYS.detail(groupId ?? ''), 'requests'],
    queryFn: () => groupsService.getJoinRequests(groupId as string),
    enabled: Boolean(groupId) && isAdmin,
    staleTime: 1000 * 20,
  });

  const invalidateGroup = () => {
    void queryClient.invalidateQueries({ queryKey: GROUP_QUERY_KEYS.detail(groupId ?? '') });
    void queryClient.invalidateQueries({ queryKey: GROUP_QUERY_KEYS.me() });
    void queryClient.invalidateQueries({ queryKey: GROUP_QUERY_KEYS.all });
  };

  const joinMutation = useMutation({
    mutationFn: (code?: string | null) =>
      groupsService.joinGroup(group?.id ?? (groupId as string), code ?? undefined),
    onSuccess: (result) => {
      invalidateGroup();
      toast.success(
        result.result === 'pending' ? t('groups.pendingSuccess') : t('groups.joinSuccess')
      );
      if (result.result === 'joined') {
        setSearchParams({ tab: 'overview' });
      }
    },
    onError: (error) => toast.error(resolveGroupErrorMessage(error, language)),
  });

  const leaveMutation = useMutation({
    mutationFn: () => groupsService.leaveGroup(groupId as string),
    onSuccess: () => {
      invalidateGroup();
      toast.success(t('groups.leaveSuccess'));
      navigate('/groups', { replace: true });
    },
    onError: (error) => toast.error(resolveGroupErrorMessage(error, language)),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      groupsService.updateGroup(groupId as string, {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        icon: icon || null,
        description: description.trim() || null,
        visibility,
        maxMembers,
      }),
    onSuccess: () => {
      invalidateGroup();
      toast.success(t('groups.saved'));
    },
    onError: (error) => toast.error(resolveGroupErrorMessage(error, language)),
  });

  const joinCodeMutation = useMutation({
    mutationFn: () => groupsService.getJoinCode(groupId as string),
    onSuccess: (data) => setJoinCode(data.joinCode),
    onError: (error) => toast.error(resolveGroupErrorMessage(error, language)),
  });

  const regenerateMutation = useMutation({
    mutationFn: () =>
      groupsService.updateGroup(groupId as string, { regenerateJoinCode: true }),
    onSuccess: () => {
      setJoinCode(null);
      joinCodeMutation.mutate();
      void queryClient.invalidateQueries({
        queryKey: [...GROUP_QUERY_KEYS.detail(groupId ?? ''), 'join-code'],
      });
      invalidateGroup();
      toast.success(t('groups.saved'));
    },
    onError: (error) => toast.error(resolveGroupErrorMessage(error, language)),
  });

  const disbandMutation = useMutation({
    mutationFn: () => groupsService.updateGroup(groupId as string, { disband: true }),
    onSuccess: () => {
      invalidateGroup();
      toast.success(t('groups.disbanded'));
      navigate('/groups', { replace: true });
    },
    onError: (error) => toast.error(resolveGroupErrorMessage(error, language)),
  });

  const kickMutation = useMutation({
    mutationFn: (memberId: string) => groupsService.kickMember(groupId as string, memberId),
    onSuccess: () => {
      invalidateGroup();
      toast.success(t('groups.banned'));
    },
    onError: (error) => toast.error(resolveGroupErrorMessage(error, language)),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ memberId, approve }: { memberId: string; approve: boolean }) =>
      groupsService.reviewJoinRequest(groupId as string, memberId, approve),
    onSuccess: () => {
      invalidateGroup();
      void requests.refetch();
      toast.success(t('groups.saved'));
    },
    onError: (error) => toast.error(resolveGroupErrorMessage(error, language)),
  });

  const battleJoinMutation = useMutation({
    mutationFn: (battleId: string) => groupsService.joinBattle(battleId),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: GROUP_QUERY_KEYS.battles(groupId ?? '') });
      navigate(`/groups/${group?.slug ?? groupId}/battles/${data.battle_id}`);
    },
    onError: (error) => toast.error(resolveGroupErrorMessage(error, language)),
  });

  const battleCancelMutation = useMutation({
    mutationFn: (battleId: string) => groupsService.cancelBattle(battleId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: GROUP_QUERY_KEYS.battles(groupId ?? '') });
      toast.success(t('groups.cancelled'));
    },
    onError: (error) => toast.error(resolveGroupErrorMessage(error, language)),
  });

  const members = useMemo(() => detail.data?.members ?? [], [detail.data?.members]);
  const pendingRequests = requests.data?.requests ?? [];

  if (detail.isLoading) {
    return (
      <div className="-m-4 min-h-[calc(100vh-4rem)] bg-grp-bg px-4 pt-4 pb-28 md:-m-6 md:px-6 md:pt-6 md:pb-10">
        <div className="mx-auto max-w-2xl space-y-5">
          <Skeleton className="h-10 w-32 rounded-lg" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-[72px] w-[72px] rounded-2xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-7 w-44 rounded-lg" />
              <Skeleton className="h-4 w-32 rounded-lg" />
            </div>
          </div>
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (detail.isError && !group) {
    return (
      <div className="-m-4 min-h-[calc(100vh-4rem)] bg-grp-bg px-4 pt-12 pb-28 text-center font-hind-bangla md:-m-6 md:px-6">
        <div className="mx-auto max-w-md space-y-4">
          <p className="text-[16px] font-semibold text-grp-text">
            {resolveGroupErrorMessage(detail.error, language)}
          </p>
          <button
            type="button"
            onClick={() => navigate('/groups')}
            className="min-h-[44px] rounded-xl bg-grp-primary px-6 text-[15px] font-semibold text-white hover:bg-grp-primary-dark"
          >
            {t('groups.backToGroup')}
          </button>
        </div>
      </div>
    );
  }

  if (!group) return null;

  const inviteIdentifier = group.slug ?? group.id;

  const shareGroup = async (withCode = false) => {
    try {
      let codeToShare: string | null = null;
      if (withCode) {
        if (activeJoinCode) {
          codeToShare = activeJoinCode;
        } else {
          const result = await groupsService.getJoinCode(group.id);
          codeToShare = result.joinCode || null;
        }
      }
      const url = groupShareUrl(inviteIdentifier, codeToShare);
      const text = t('groups.shareMessage', { name: group.name });
      if (navigator.share) {
        await navigator.share({ title: group.name, text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        toast.success(t('groups.linkCopied'));
      }
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') return;
      toast.error(t('groups.shareFailed'));
    }
  };

  const copyJoinCode = async () => {
    if (!activeJoinCode) return;
    try {
      await navigator.clipboard.writeText(activeJoinCode);
      toast.success(t('groups.copied'));
    } catch {
      toast.error(t('groups.saveFailed'));
    }
  };

  const setTab = (next: Tab) => setSearchParams({ tab: next });

  const typeLabel =
    group.group_type === 'squad'
      ? t('groups.filterSquads')
      : t('groups.filterCommunities');

  return (
    <PullToRefresh
      onRefresh={async () => {
        await detail.refetch();
        await battles.refetch();
      }}
    >
      <div className="-m-4 min-h-[calc(100vh-4rem)] bg-grp-bg px-4 pt-2 pb-24 text-grp-text font-hind-bangla md:-m-6 md:px-6 md:pt-6 md:pb-10">
        <div className="mx-auto max-w-2xl space-y-3">
          {/* Top bar: Back + group identity + Three-dot menu */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => navigate('/groups')}
              aria-label={t('groups.title')}
              className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-grp-text transition-colors hover:bg-grp-surface-tint focus:outline-none focus-visible:ring-2 focus-visible:ring-grp-primary"
            >
              <ChevronLeft className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
            </button>
            <GroupShieldTile size="sm" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[18px] font-bold leading-tight text-grp-text">
                {group.name}
              </h1>
              <p className="truncate text-[12px] leading-snug text-grp-muted tabular-nums">
                {typeLabel} · {t('groups.level')} {localizeDigits(group.group_level, language)} ·{' '}
                {localizeDigits(group.member_count, language)}/
                {localizeDigits(group.max_members, language)} {t('groups.members')}
              </p>
            </div>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                aria-label={t('groups.moreOptions')}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-grp-text transition-colors hover:bg-grp-surface-tint focus:outline-none focus-visible:ring-2 focus-visible:ring-grp-primary"
              >
                <MoreVertical className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-12 z-40 min-w-[180px] rounded-2xl border border-grp-hairline bg-grp-bg py-1.5 shadow-lg"
                >
                  {isOwner && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        setTab('settings');
                      }}
                      className="flex min-h-[44px] w-full items-center gap-2.5 px-4 text-left text-[14px] font-medium text-grp-text hover:bg-grp-surface-tint"
                    >
                      <Settings className="h-4 w-4 text-grp-muted" strokeWidth={2} aria-hidden="true" />
                      <span>{t('groups.settings')}</span>
                    </button>
                  )}

                  {!isOwner && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        void shareGroup(false);
                      }}
                      className="flex min-h-[44px] w-full items-center gap-2.5 px-4 text-left text-[14px] font-medium text-grp-text hover:bg-grp-surface-tint"
                    >
                      <Share2 className="h-4 w-4 text-grp-muted" strokeWidth={2} aria-hidden="true" />
                      <span>{t('groups.share')}</span>
                    </button>
                  )}

                  {(isMember || isPending) && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        setConfirm({
                          title: isPending ? t('groups.pending') : t('groups.leave'),
                          message: t('groups.leaveConfirm'),
                          onConfirm: () => leaveMutation.mutate(),
                        });
                      }}
                      className="flex min-h-[44px] w-full items-center gap-2.5 px-4 text-left text-[14px] font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      <LogOut className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                      <span>{t('groups.leave')}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Borderless Group Header */}
          <header className="space-y-2">
            {group.description && (
              <p className="text-[14px] leading-snug text-grp-muted">{group.description}</p>
            )}

            {/* Non-member join controls */}
            {!isMember && !isPending && membershipStatus !== 'kicked' && group.is_active && (
              <div className="pt-1">
                {group.visibility === 'code' ? (
                  <div className="flex items-center gap-1.5 rounded-xl bg-grp-surface-tint p-1.5">
                    <label htmlFor="detail-join-code-input" className="sr-only">
                      {t('groups.enterCode')}
                    </label>
                    <input
                      id="detail-join-code-input"
                      type="text"
                      value={joinCodeInput}
                      onChange={(event) =>
                        setJoinCodeInput(event.target.value.toUpperCase().slice(0, 16))
                      }
                      placeholder={t('groups.enterCode')}
                      className="min-h-[40px] min-w-0 flex-1 rounded-lg bg-grp-bg px-3 text-[14px] text-grp-text placeholder:text-grp-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-grp-primary"
                    />
                    <button
                      type="button"
                      disabled={!joinCodeInput.trim() || joinMutation.isPending}
                      onClick={() => joinMutation.mutate(joinCodeInput.trim())}
                      className="min-h-[40px] shrink-0 whitespace-nowrap rounded-lg bg-grp-primary px-4 text-[14px] font-semibold text-white transition-colors hover:bg-grp-primary-dark disabled:opacity-50"
                    >
                      {joinMutation.isPending ? t('common.loading') : t('groups.joinAction')}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={
                      joinMutation.isPending ||
                      Number(group.member_count) >= Number(group.max_members)
                    }
                    onClick={() => joinMutation.mutate(null)}
                    className="min-h-[44px] rounded-xl bg-grp-primary px-6 text-[15px] font-semibold text-white transition-colors hover:bg-grp-primary-dark disabled:opacity-50"
                  >
                    {Number(group.member_count) >= Number(group.max_members)
                      ? t('groups.fullGroup')
                      : group.visibility === 'approval'
                        ? t('groups.requestAction')
                        : t('groups.joinAction')}
                  </button>
                )}
              </div>
            )}

            {isPending && (
              <p className="text-[13px] font-medium text-grp-primary">
                {t('groups.statusPending')}
              </p>
            )}

            {membershipStatus === 'kicked' && (
              <p className="text-[14px] text-red-600 dark:text-red-400">
                {t('groups.statusKicked')}
              </p>
            )}
          </header>

          {/* Three-column Stats Row between horizontal hairlines */}
          <section
            aria-label={t('groups.overview')}
            className="grid grid-cols-3 divide-x divide-grp-hairline border-y border-grp-hairline py-2 text-center"
          >
            <div className="px-2">
              <p className="text-[18px] font-bold leading-tight text-grp-text tabular-nums">
                {localizeDigits(group.total_xp, language)}
              </p>
              <p className="mt-0.5 text-[12px] text-grp-muted">{t('groups.totalXp')}</p>
            </div>
            <div className="px-2">
              <p className="text-[18px] font-bold leading-tight text-grp-text tabular-nums">
                {localizeDigits(group.current_streak, language)}
              </p>
              <p className="mt-0.5 text-[12px] text-grp-muted">{t('groups.streak')}</p>
            </div>
            <div className="px-2">
              <p className="text-[18px] font-bold leading-tight text-grp-text tabular-nums">
                {localizeDigits(group.member_count, language)}
              </p>
              <p className="mt-0.5 text-[12px] text-grp-muted">{t('groups.members')}</p>
            </div>
          </section>

          {/* Tinted Invite Box (members only when current rules allow — owner holds join-code permission) */}
          {isMember && isOwner && (
            <section className="rounded-xl bg-grp-surface-tint p-2">
              <div className="flex items-center gap-1.5">
                <div
                  title={t('groups.inviteFriends')}
                  className="flex min-h-[40px] min-w-0 flex-1 items-center justify-center rounded-lg bg-grp-bg px-3"
                >
                  <code className="truncate font-mono text-[15px] font-semibold tracking-[0.24em] text-grp-text">
                    {activeJoinCode ?? '········'}
                  </code>
                </div>
                <button
                  type="button"
                  disabled={!activeJoinCode}
                  onClick={() => void copyJoinCode()}
                  className="min-h-[40px] shrink-0 whitespace-nowrap rounded-lg border border-grp-primary/40 bg-grp-bg px-3.5 text-[13px] font-semibold text-grp-primary transition-colors hover:bg-grp-primary-tint disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-grp-primary"
                >
                  {t('groups.copy')}
                </button>
                <button
                  type="button"
                  aria-label={t('groups.shareGroup')}
                  title={t('groups.shareGroup')}
                  onClick={() => void shareGroup(group.visibility === 'code')}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-grp-primary text-white transition-colors hover:bg-grp-primary-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-grp-primary focus-visible:ring-offset-2"
                >
                  <Share2 className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            </section>
          )}

          {!isMember && !isPending && (
            <section className="border-t border-grp-hairline pt-4">
              <h2 className="text-[17px] font-bold text-grp-text">{t('groups.previewAbout')}</h2>
              <p className="mt-1 text-[15px] text-grp-muted">
                {group.description || t('groups.noResults')}
              </p>
            </section>
          )}

          {/* Underline Tabs */}
          {isMember && (
            <div
              role="tablist"
              aria-label={group.name}
              className="no-scrollbar flex items-center gap-5 overflow-x-auto border-b border-grp-hairline"
            >
              {TABS.map((value) => {
                const active = tab === value;
                const label =
                  value === 'overview'
                    ? t('groups.overview')
                    : value === 'members'
                      ? t('groups.membersTab')
                      : value === 'chat'
                        ? t('groups.chat')
                        : t('groups.battles');

                return (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(value)}
                    className={`relative min-h-[40px] shrink-0 whitespace-nowrap px-0.5 text-[14px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-grp-primary ${
                      active
                        ? 'font-bold text-grp-primary'
                        : 'font-medium text-grp-muted hover:text-grp-text'
                    }`}
                  >
                    {label}
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
          )}

          {/* Overview Tab: Single flat Members list */}
          {tab === 'overview' && (
            <section className="space-y-1">
              <h2 className="text-[14px] font-semibold leading-snug text-grp-muted">
                {t('groups.membersTab')}
              </h2>
              <div className="divide-y divide-grp-hairline">
                {members.slice(0, 5).map((member, index) => (
                  <MemberRow
                    key={member.id}
                    membership={member}
                    rank={index + 1}
                    showKick={false}
                  />
                ))}
              </div>
              {members.length === 0 && (
                <p className="py-6 text-center text-[15px] text-grp-muted">{t('common.noData')}</p>
              )}
              {members.length > 5 && (
                <button
                  type="button"
                  onClick={() => setTab('members')}
                  className="min-h-[44px] w-full text-center text-[14px] font-semibold text-grp-primary hover:text-grp-primary-dark"
                >
                  {t('groups.membersTab')} ({localizeDigits(members.length, language)})
                </button>
              )}
            </section>
          )}

          {/* Members Tab */}
          {tab === 'members' && (
            <section className="space-y-4">
              <div>
                <h2 className="text-[14px] font-semibold leading-snug text-grp-muted">
                  {t('groups.membersTab')} ({localizeDigits(members.length, language)})
                </h2>
                <div className="mt-1 divide-y divide-grp-hairline">
                  {members.map((member, index) => (
                    <MemberRow
                      key={member.id}
                      membership={member}
                      rank={index + 1}
                      canKick={
                        isAdmin &&
                        member.user_id !== user?.id &&
                        member.user_id !== group.created_by
                      }
                      showKick={isAdmin}
                      onKick={() =>
                        setConfirm({
                          title: t('groups.kick'),
                          message: t('groups.kickConfirm'),
                          onConfirm: () => kickMutation.mutate(member.user_id),
                        })
                      }
                    />
                  ))}
                </div>
                {members.length === 0 && (
                  <p className="py-6 text-center text-[15px] text-grp-muted">{t('common.noData')}</p>
                )}
              </div>

              {isAdmin && (
                <div className="border-t border-grp-hairline pt-4">
                  <h3 className="text-[16px] font-bold text-grp-text">{t('groups.requests')}</h3>
                  {pendingRequests.length === 0 ? (
                    <p className="mt-1 text-[14px] text-grp-muted">{t('groups.noRequests')}</p>
                  ) : (
                    <div className="mt-1 divide-y divide-grp-hairline">
                      {pendingRequests.map((request) => (
                        <MemberRow
                          key={request.id}
                          membership={request}
                          isPendingRequest
                          onApprove={() =>
                            reviewMutation.mutate({ memberId: request.user_id, approve: true })
                          }
                          onReject={() =>
                            reviewMutation.mutate({ memberId: request.user_id, approve: false })
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Chat Tab */}
          {tab === 'chat' && (
            <section>
              <GroupChat
                groupId={group.id}
                groupSlug={group.slug ?? group.id}
                canSend={isMember}
                isAdmin={isAdmin}
              />
            </section>
          )}

          {/* Battles Tab */}
          {tab === 'battles' && (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="inline-flex items-center gap-2 text-[17px] font-bold text-grp-text">
                  <Swords className="h-5 w-5 text-grp-primary" strokeWidth={2} aria-hidden="true" />
                  <span>{t('groups.battles')}</span>
                </h2>
                {isAdmin && (
                  <Button
                    size="sm"
                    onClick={() => setShowBattleForm((value) => !value)}
                    className="min-h-[44px]"
                  >
                    {t('groups.createBattle')}
                  </Button>
                )}
              </div>

              {showBattleForm && isAdmin && (
                <BattleCreateForm
                  groupId={group.id}
                  onCreated={() => setShowBattleForm(false)}
                />
              )}

              {battles.isLoading ? (
                <Skeleton className="h-24 w-full rounded-2xl" />
              ) : (
                <BattleList
                  battles={battles.data?.battles ?? []}
                  nowMs={nowMs}
                  isAdmin={isAdmin}
                  onJoin={(battleId) => battleJoinMutation.mutate(battleId)}
                  onOpen={(battleId) =>
                    navigate(`/groups/${group.slug ?? group.id}/battles/${battleId}`)
                  }
                  onCancel={(battleId) => battleCancelMutation.mutate(battleId)}
                  joiningId={battleJoinMutation.isPending ? battleJoinMutation.variables : null}
                />
              )}
            </section>
          )}

          {/* Settings Tab (owner only) */}
          {tab === 'settings' && isOwner && (
            <section className="space-y-5">
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (updateMutation.isPending) return;
                  updateMutation.mutate();
                }}
              >
                <h2 className="text-[17px] font-bold text-grp-text">{t('groups.settings')}</h2>

                <label className="block text-[13px] font-medium text-grp-muted">
                  {t('groups.name')}
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value.slice(0, 50))}
                    className="mt-1 min-h-[44px]"
                    minLength={2}
                    maxLength={50}
                  />
                </label>

                <label className="block text-[13px] font-medium text-grp-muted">
                  {t('groups.slug')}
                  <Input
                    value={slug}
                    onChange={(event) => setSlug(event.target.value.toLowerCase().slice(0, 40))}
                    className="mt-1 min-h-[44px]"
                    placeholder={t('groups.slugPlaceholder')}
                    minLength={3}
                    maxLength={40}
                  />
                  <span className="mt-1 block text-xs">{t('groups.slugHint')}</span>
                  <span className="mt-1 block text-xs text-amber-600">
                    {t('groups.settingsSlugWarning')}
                  </span>
                </label>

                <label className="block text-[13px] font-medium text-grp-muted">
                  {t('groups.icon')}
                  <Input
                    value={icon}
                    onChange={(event) => setIcon(event.target.value.slice(0, 8))}
                    className="mt-1 min-h-[44px]"
                    maxLength={8}
                  />
                </label>

                <label className="block text-[13px] font-medium text-grp-muted">
                  {t('groups.description')}
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value.slice(0, 300))}
                    rows={3}
                    maxLength={300}
                    className="mt-1 w-full resize-none rounded-lg border border-input-border bg-input-bg px-3 py-2 text-[15px] text-grp-text focus:outline-none focus:ring-2 focus:ring-grp-primary"
                  />
                </label>

                <label className="block text-[13px] font-medium text-grp-muted">
                  {t('groups.visibility')}
                  <select
                    value={visibility}
                    onChange={(event) =>
                      setVisibility(event.target.value as 'public' | 'code' | 'approval')
                    }
                    className="mt-1 min-h-[44px] w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-[15px] text-grp-text"
                  >
                    <option value="public">{t('groups.visibilityPublic')}</option>
                    <option value="code">{t('groups.visibilityCode')}</option>
                    <option value="approval">{t('groups.visibilityApproval')}</option>
                  </select>
                </label>

                <label className="block text-[13px] font-medium text-grp-muted">
                  {t('groups.maxMembers')}
                  <Input
                    type="number"
                    min={Math.max(2, group.member_count)}
                    max={
                      group.group_type === 'community'
                        ? config?.communityMaxMembers ?? 200
                        : config?.squadMaxMembers ?? 50
                    }
                    value={maxMembers}
                    onChange={(event) => setMaxMembers(Number(event.target.value))}
                    className="mt-1 min-h-[44px]"
                  />
                </label>

                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="min-h-[44px] w-full rounded-xl bg-grp-primary px-5 text-[15px] font-semibold text-white transition-colors hover:bg-grp-primary-dark disabled:opacity-50"
                >
                  {updateMutation.isPending ? t('common.loading') : t('groups.save')}
                </button>
              </form>

              <div className="space-y-2.5 border-t border-grp-hairline pt-4">
                <button
                  type="button"
                  disabled={regenerateMutation.isPending}
                  onClick={() =>
                    setConfirm({
                      title: t('groups.regenerateCode'),
                      message: t('groups.joinCode'),
                      onConfirm: () => regenerateMutation.mutate(),
                    })
                  }
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-grp-hairline px-4 text-[14px] font-semibold text-grp-text transition-colors hover:bg-grp-surface-tint disabled:opacity-50"
                >
                  <RefreshCw className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                  <span>{t('groups.regenerateCode')}</span>
                </button>

                <Button
                  variant="danger"
                  className="min-h-[44px] w-full"
                  onClick={() =>
                    setConfirm({
                      title: t('groups.disband'),
                      message: t('groups.disbandConfirm'),
                      onConfirm: () => disbandMutation.mutate(),
                    })
                  }
                >
                  {t('groups.disband')}
                </Button>
              </div>
            </section>
          )}

          <ConfirmModal
            isOpen={Boolean(confirm)}
            title={confirm?.title ?? ''}
            message={confirm?.message ?? ''}
            onConfirm={() => {
              confirm?.onConfirm();
              setConfirm(null);
            }}
            onCancel={() => setConfirm(null)}
            isLoading={
              leaveMutation.isPending ||
              disbandMutation.isPending ||
              kickMutation.isPending ||
              regenerateMutation.isPending
            }
          />
        </div>
      </div>
    </PullToRefresh>
  );
};

export default GroupDetail;
