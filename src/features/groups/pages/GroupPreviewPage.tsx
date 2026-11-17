import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Flame, Lock, Share2, Trophy, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/shared/components/ui/Button';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import EmptyState from '@/shared/components/ui/EmptyState';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import { GroupAvatar } from '../components/GroupAvatar';
import { groupsService } from '../services/groupsService';
import { resolveGroupErrorMessage } from '../utils/errorMessages';
import { groupShareUrl } from '../utils/groupSlug';

const GroupPreviewPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const location = useLocation();
  const { language, t } = useLanguage();

  const previewQuery = useQuery({
    queryKey: ['groups', 'public-preview', groupId ?? ''],
    queryFn: () => groupsService.getPreview(groupId as string),
    enabled: Boolean(groupId),
    staleTime: 60_000,
    retry: 1,
  });

  const preview = previewQuery.data?.preview;

  const share = async () => {
    if (!preview) return;
    const url = groupShareUrl(preview.slug ?? groupId ?? '');
    const text = t('groups.shareMessage', { name: preview.name });
    try {
      if (navigator.share) {
        await navigator.share({ title: preview.name, text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        toast.success(t('groups.linkCopied'));
      }
    } catch (error) {
      if ((error as { name?: string })?.name !== 'AbortError') {
        toast.error(t('groups.shareFailed'));
      }
    }
  };

  return (
    <div className="min-h-screen bg-app px-4 py-8 text-text-primary">
      <div className="mx-auto max-w-xl space-y-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-lg font-bold text-primary">
            {t('brand.name')}
          </Link>
          <Link
            to="/auth/login"
            state={{ from: location }}
            className="rounded-lg border border-card-border px-3 py-2 text-sm font-medium"
          >
            {t('groups.loginToJoin')}
          </Link>
        </div>

        {previewQuery.isLoading && (
          <div className="space-y-3 rounded-2xl border border-card-border bg-card-bg p-5">
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {previewQuery.isError && (
          <EmptyState message={resolveGroupErrorMessage(previewQuery.error, language)} />
        )}

        {preview && (
          <div className="space-y-4 rounded-2xl border border-card-border bg-card-bg p-5">
            <div className="flex items-start gap-4">
              <GroupAvatar icon={preview.icon} name={preview.name} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                  {t('groups.previewTitle')}
                </p>
                <h1 className="truncate text-2xl font-bold">{preview.name}</h1>
                <p className="mt-1 text-sm text-text-secondary">
                  {preview.group_type === 'squad'
                    ? t('groups.filterSquads')
                    : t('groups.filterCommunities')}
                  {' · '}
                  {preview.visibility === 'public'
                    ? t('groups.visibilityPublic')
                    : preview.visibility === 'code'
                      ? t('groups.visibilityCode')
                      : t('groups.visibilityApproval')}
                </p>
              </div>
            </div>

            <p className="text-sm text-text-secondary">
              {preview.description || t('groups.noResults')}
            </p>

            <div className="flex flex-wrap gap-4 text-sm text-text-secondary">
              <span className="inline-flex items-center gap-1">
                <Users className="h-4 w-4" />
                {localizeDigits(preview.member_count, language)}/
                {localizeDigits(preview.max_members, language)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Trophy className="h-4 w-4" />
                {localizeDigits(preview.total_xp, language)} XP
              </span>
              <span className="inline-flex items-center gap-1">
                <Flame className="h-4 w-4" />
                {t('groups.level')} {localizeDigits(preview.group_level, language)}
              </span>
            </div>

            {preview.is_full ? (
              <p className="rounded-xl bg-secondary px-3 py-2 text-sm text-text-secondary">
                {t('groups.fullGroup')}
              </p>
            ) : (
              <div className="space-y-2">
                <Link
                  to="/auth/login"
                  state={{ from: location }}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"
                >
                  {t('groups.loginToJoin')}
                </Link>
                {location.search.includes('code=') && (
                  <p className="inline-flex items-center gap-1 text-xs text-text-secondary">
                    <Lock className="h-3 w-3" /> {t('groups.joinCodeRequired')}
                  </p>
                )}
              </div>
            )}

            <Button variant="secondary" className="w-full" onClick={() => void share()}>
              <Share2 className="mr-1 h-4 w-4" /> {t('groups.share')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupPreviewPage;
