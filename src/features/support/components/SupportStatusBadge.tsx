import React from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { STATUS_GROUP_LABEL_KEYS, statusGroup } from '../utils/supportTickets';
import type { SupportStatus } from '../types/supportTypes';

const GROUP_STYLES: Record<'active' | 'resolved', string> = {
  active: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  resolved: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
};

const SupportStatusBadge: React.FC<{ status: SupportStatus }> = ({ status }) => {
  const { t } = useLanguage();
  const group = statusGroup(status);

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${GROUP_STYLES[group]}`}
    >
      {t(STATUS_GROUP_LABEL_KEYS[group])}
    </span>
  );
};

export default SupportStatusBadge;
