import React from 'react';
import { AlertTriangle, Megaphone, Pin } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { NoticePriority } from '../types/noticeTypes';

interface NoticePriorityBadgeProps {
  priority: NoticePriority;
}

const STYLES: Record<NoticePriority, string> = {
  urgent: 'bg-red-500/10 text-red-600 dark:text-red-400',
  important: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  normal: 'bg-primary/10 text-primary',
};

const ICONS = {
  urgent: AlertTriangle,
  important: Pin,
  normal: Megaphone,
};

export const NoticePriorityBadge: React.FC<NoticePriorityBadgeProps> = ({
  priority,
}) => {
  const { t } = useLanguage();
  const Icon = ICONS[priority];
  const labelKey =
    priority === 'urgent'
      ? 'notice.urgent'
      : priority === 'important'
        ? 'notice.important'
        : 'notice.normal';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold leading-4 ${STYLES[priority]}`}
    >
      <Icon size={11} aria-hidden="true" />
      {t(labelKey)}
    </span>
  );
};

export default NoticePriorityBadge;
