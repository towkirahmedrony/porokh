import React from 'react';
import { Button } from '@/shared/components/ui/Button';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import type { GroupMembership } from '../types';

type MemberRowProps = {
  membership: GroupMembership;
  rank?: number;
  canKick?: boolean;
  showKick?: boolean;
  onKick?: () => void;
  isPendingRequest?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
};

export const MemberRow: React.FC<MemberRowProps> = ({
  membership,
  rank,
  canKick,
  showKick,
  onKick,
  isPendingRequest,
  onApprove,
  onReject,
}) => {
  const { language, t } = useLanguage();
  const profile = membership.profile;
  const name = profile?.full_name || profile?.username || 'Student';
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="flex min-h-[60px] items-center gap-3 py-3">
      {typeof rank === 'number' && (
        <span
          className={`w-6 shrink-0 text-center text-[15px] font-bold tabular-nums ${
            rank === 1 ? 'text-grp-gold-ink' : 'text-grp-muted'
          }`}
        >
          {localizeDigits(rank, language)}
        </span>
      )}

      {profile?.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={name}
          className="h-10 w-10 shrink-0 rounded-full object-cover"
          loading="lazy"
        />
      ) : (
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-grp-primary text-[15px] font-bold text-white"
          aria-hidden="true"
        >
          {initial}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold leading-snug text-grp-text">
          {name}
        </p>
        <p className="mt-0.5 truncate text-[13px] leading-snug text-grp-muted tabular-nums">
          {t('groups.xp')} {localizeDigits(membership.contribution_xp ?? 0, language)}
          {profile?.institution ? ` · ${profile.institution}` : ''}
        </p>
      </div>

      {membership.role === 'admin' && !isPendingRequest && !(showKick && canKick) && (
        <span className="shrink-0 whitespace-nowrap rounded-md bg-grp-primary-tint px-2.5 py-1 text-[12px] font-semibold text-grp-primary">
          {t('groups.admin')}
        </span>
      )}

      {isPendingRequest && (
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" onClick={onApprove} className="min-h-[44px]">
            {t('groups.approve')}
          </Button>
          <Button size="sm" variant="secondary" onClick={onReject} className="min-h-[44px]">
            {t('groups.reject')}
          </Button>
        </div>
      )}

      {showKick && canKick && (
        <div className="flex shrink-0 items-center gap-2">
          {membership.role === 'admin' && (
            <span className="shrink-0 whitespace-nowrap rounded-md bg-grp-primary-tint px-2.5 py-1 text-[12px] font-semibold text-grp-primary">
              {t('groups.admin')}
            </span>
          )}
          <Button size="sm" variant="danger" onClick={onKick} className="min-h-[44px]">
            {t('groups.kick')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default MemberRow;
