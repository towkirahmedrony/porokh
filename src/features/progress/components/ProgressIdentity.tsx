import React from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { formatBatchLabel } from '@/shared/lib/academic';
import type { ProgressUser } from '../types/progress';

interface ProgressIdentityProps {
  user: ProgressUser;
}

/**
 * Who this report belongs to. The chip is the batch the server sent (the
 * `class_label` field holds `hsc_batch` now); when none is stored no chip is
 * drawn, so the screen never claims a batch the profile does not have.
 */
export const ProgressIdentity: React.FC<ProgressIdentityProps> = ({ user }) => {
  const { language, t } = useLanguage();

  const name = user.name?.trim() || t('progress.studentFallback');
  const initial = name.charAt(0).toUpperCase();
  const batchLabel = formatBatchLabel(user.class_label?.trim(), language);

  return (
    <header className="flex items-center gap-3">
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
        <p className="truncate text-[16px] font-bold leading-6 text-text-primary">{name}</p>
        {batchLabel ? (
          <div className="mt-1">
            <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
              {batchLabel}
            </span>
          </div>
        ) : null}
      </div>
    </header>
  );
};
