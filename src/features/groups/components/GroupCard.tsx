import React from 'react';
import { Lock, ShieldCheck, Users } from 'lucide-react';
import { Badge } from '@/shared/components/ui/Badge';
import { Button } from '@/shared/components/ui/Button';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import type { Group } from '../types';
import { GroupAvatar } from './GroupAvatar';

type GroupCardProps = {
  group: Group;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  onOpen?: () => void;
  pending?: boolean;
};

export const GroupCard: React.FC<GroupCardProps> = ({
  group,
  actionLabel,
  onAction,
  actionDisabled,
  onOpen,
  pending,
}) => {
  const { language, t } = useLanguage();
  const isFull = group.member_count >= group.max_members;

  const visibilityLabel =
    group.visibility === 'public'
      ? t('groups.visibilityPublic')
      : group.visibility === 'approval'
        ? t('groups.visibilityApproval')
        : t('groups.visibilityCode');

  return (
    <div className="rounded-2xl border border-card-border bg-card-bg p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <GroupAvatar icon={group.icon} name={group.name} />
        <button
          type="button"
          onClick={onOpen}
          disabled={!onOpen}
          className="min-w-0 flex-1 text-left disabled:cursor-default"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-bold text-text-primary">{group.name}</h3>
            <Badge className="bg-secondary text-text-secondary">
              {group.group_type === 'squad' ? t('groups.filterSquads') : t('groups.filterCommunities')}
            </Badge>
          </div>
          {group.description && (
            <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{group.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {localizeDigits(group.member_count, language)}/
              {localizeDigits(group.max_members, language)}
            </span>
            <span className="inline-flex items-center gap-1">
              {group.visibility === 'public' ? (
                <ShieldCheck className="h-3.5 w-3.5" />
              ) : (
                <Lock className="h-3.5 w-3.5" />
              )}
              {visibilityLabel}
            </span>
            <span>
              {t('groups.level')} {localizeDigits(group.group_level ?? 1, language)}
            </span>
          </div>
        </button>

        {actionLabel && onAction && (
          <Button
            size="sm"
            variant={isFull ? 'secondary' : 'primary'}
            onClick={onAction}
            disabled={isFull || actionDisabled}
          >
            {isFull ? t('groups.full') : actionLabel}
          </Button>
        )}

        {pending && (
          <Badge className="bg-accent/20 text-primary">{t('groups.pending')}</Badge>
        )}
      </div>
    </div>
  );
};

export default GroupCard;
