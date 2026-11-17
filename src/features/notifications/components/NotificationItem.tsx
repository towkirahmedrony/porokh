import React, { memo } from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { pickLang } from '@/shared/i18n/localize';
import { LOCALE_BY_LANGUAGE, type AppLanguage } from '@/shared/i18n/messages';
import {
  Bell,
  Megaphone,
  Clock,
  ChevronRight,
  ExternalLink,
  GraduationCap,
  Gift,
  Flame,
  Users,
  CreditCard,
  Shield,
  LucideIcon,
} from 'lucide-react';
import { DBNotificationItem } from '../types/notificationTypes'; 

interface NotificationItemProps {
  item: DBNotificationItem;
  activeTab: 'notifications' | 'notices';
  onClick: (item: DBNotificationItem) => void;
}

// Extracted outside the component to prevent function recreation on every render
const formatTime = (isoString: string, language: AppLanguage) => {
  if (!isoString) return '';
  const utcDateStr = isoString.endsWith('Z') ? isoString : `${isoString}Z`;
  const date = new Date(utcDateStr);
  
  const locale = LOCALE_BY_LANGUAGE[language];

  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) + ', ' +
         date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
};

const ICON_BY_TYPE: Record<string, LucideIcon> = {
  exam: GraduationCap,
  reward: Gift,
  streak: Flame,
  social: Users,
  billing: CreditCard,
  security: Shield,
};

const NotificationItem: React.FC<NotificationItemProps> = ({ item, activeTab, onClick }) => {
  const { t, language } = useLanguage();
  const isRead = item.notification_reads?.[0]?.is_read || false;
  const TypeIcon = ICON_BY_TYPE[item.type] ?? (activeTab === 'notifications' ? Bell : Megaphone);

  return (
    <div 
      onClick={() => onClick(item)}
      className={`relative group flex gap-4 p-4 rounded-xl border transition-all active:scale-[0.99] cursor-pointer shadow-sm border-border-color ${
        isRead ? 'bg-surface text-text-secondary' : 'bg-card-bg text-text-primary'
      }`}
    >
      <div className="shrink-0">
        {item.image_url ? (
          <img 
            src={item.image_url} 
            alt=""
            className="w-10 h-10 rounded-full object-cover border border-border-color bg-secondary"
          />
        ) : (
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary/10 text-primary">
            <TypeIcon size={20} />
          </div>
        )}
      </div>

      <div className="flex-1 space-y-1">
        <div className="flex justify-between items-start">
          <h3 className={`text-sm ${isRead ? 'font-medium text-text-secondary' : 'font-bold text-text-primary'}`}>
            {pickLang(language, item.title_bn, item.title_en)}
          </h3>
          {!isRead && (
            <span className="w-2 h-2 rounded-full mt-1.5 animate-pulse bg-accent" />
          )}
        </div>
        <p className={`text-xs leading-relaxed line-clamp-2 ${isRead ? 'text-text-secondary/80' : 'text-text-secondary'}`}>
          {pickLang(language, item.body_bn, item.body_en)}
        </p>
        <div className="flex items-center gap-3 pt-1">
          <div className="flex items-center gap-1 text-text-secondary opacity-80">
            <Clock size={12} />
            <span className="text-[10px]">{formatTime(item.created_at, language)}</span>
          </div>
          {item.action_link && (
            <div className="flex items-center gap-1 text-[10px] text-primary hover:underline">
              <span>{t('notification.visit')}</span>
              <ExternalLink size={10} />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center text-text-secondary opacity-60">
        <ChevronRight size={16} />
      </div>
    </div>
  );
};

// React.memo prevents unnecessary re-renders of list items if their props haven't changed.
// TanStack Query's structural sharing ensures object references remain stable if data is unchanged.
export default memo(NotificationItem);
