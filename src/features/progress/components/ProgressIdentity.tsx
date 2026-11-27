import React from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { formatHeaderStatus } from '@/shared/lib/academic';
import { useStage } from '@/features/stage/hooks/useStage';
import { AcademicStatusChips } from '@/shared/components/ui/AcademicStatusChips';
import type { ProgressUser } from '../types/progress';

interface ProgressIdentityProps {
  user: ProgressUser;
}

/**
 * Who this report belongs to, and what they are preparing for right now.
 *
 * The chip list comes from the server-computed stage, not from the batch field
 * the report still carries: after the HSC exam the batch is no longer the
 * identity a student reads every day, and a failed stage read draws no chip
 * rather than an old one.
 */
export const ProgressIdentity: React.FC<ProgressIdentityProps> = ({ user }) => {
  const { language, t } = useLanguage();
  const stage = useStage();

  const name = user.name?.trim() || t('progress.studentFallback');
  const initial = name.charAt(0).toUpperCase();
  const statusChips = formatHeaderStatus(
    { hsc_batch: stage.batchYear, study_goal: stage.goal },
    stage.stage,
    language
  );

  return (
    <header className="flex items-start gap-3">
      {user.avatar_url ? (
        <img
          src={user.avatar_url}
          alt=""
          width={44}
          height={44}
          className="h-11 w-11 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground"
        >
          {initial}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="break-words text-[16px] font-bold leading-6 text-text-primary">
          {name}
        </p>
        <div className="mt-1.5">
          <AcademicStatusChips
            chips={stage.status === 'error' ? [] : statusChips}
            loading={stage.status === 'loading' && !stage.stage}
          />
        </div>
      </div>
    </header>
  );
};
