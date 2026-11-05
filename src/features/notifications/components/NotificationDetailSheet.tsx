import React, { memo } from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { pickLang } from '@/shared/i18n/localize';
import { LOCALE_BY_LANGUAGE, type AppLanguage } from '@/shared/i18n/messages';
import { Bell, Clock, ExternalLink, X } from 'lucide-react';
import { DBNotificationItem } from '../types/notificationTypes';
import { DEFAULT_PUSH_TARGET, resolvePushTarget } from '../native/pushRouting';

interface NotificationDetailSheetProps {
  item: DBNotificationItem | null;
  onClose: () => void;
  onOpen: (target: string) => void;
}

const formatTimestamp = (isoString: string, language: AppLanguage): string => {
  if (!isoString) return '';
  const date = new Date(isoString.endsWith('Z') ? isoString : `${isoString}Z`);
  return date.toLocaleString(LOCALE_BY_LANGUAGE[language], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Full notification view.
 *
 * A tapped notification opens here instead of navigating straight away: the
 * destination is validated against the routes this build serves, so a stored
 * `action_link` can only open an in-app screen.
 */
const NotificationDetailSheet: React.FC<NotificationDetailSheetProps> = ({
  item,
  onClose,
  onOpen,
}) => {
  const { t, language } = useLanguage();

  if (!item) return null;

  const title = pickLang(language, item.title_bn, item.title_en);
  const body = pickLang(language, item.body_bn, item.body_en);
  const target = item.action_link
    ? resolvePushTarget(item.action_link)
    : DEFAULT_PUSH_TARGET;
  const canOpen = Boolean(item.action_link) && target !== DEFAULT_PUSH_TARGET;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t('notification.title')}
    >
      <button
        type="button"
        aria-label={t('common.back')}
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg rounded-t-3xl border border-border-color bg-surface-elevated p-5 pb-8 shadow-xl animate-in slide-in-from-bottom duration-200">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bell size={18} />
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
              {item.type}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.back')}
            className="rounded-full p-1 text-text-secondary transition-colors hover:text-text-primary"
          >
            <X size={20} />
          </button>
        </div>

        {item.image_url ? (
          <img
            src={item.image_url}
            alt=""
            className="mb-3 max-h-48 w-full rounded-xl border border-border-color object-cover"
          />
        ) : null}

        <h2 className="text-lg font-bold text-text-primary">
          {title || t('notification.title')}
        </h2>

        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
          {body}
        </p>

        <div className="mt-3 flex items-center gap-1 text-text-secondary opacity-80">
          <Clock size={12} />
          <span className="text-[11px]">
            {formatTimestamp(item.created_at, language)}
          </span>
        </div>

        {canOpen ? (
          <button
            type="button"
            onClick={() => onOpen(item.action_link as string)}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {t('notification.visit')}
            <ExternalLink size={14} />
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default memo(NotificationDetailSheet);
