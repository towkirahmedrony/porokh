import React from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { STATUS_LABEL_KEYS } from '../utils/supportTickets';
import type { SupportStatus } from '../types/supportTypes';

const STATUS_STYLES: Record<SupportStatus, string> = {
  open: 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  in_progress: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  awaiting_student: 'border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  resolved: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  closed: 'border-border-color bg-surface text-text-secondary',
};

const SupportStatusBadge: React.FC<{ status: SupportStatus }> = ({ status }) => {
  const { t } = useLanguage();

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[status]}`}
    >
      {t(STATUS_LABEL_KEYS[status])}
    </span>
  );
};

export default SupportStatusBadge;
