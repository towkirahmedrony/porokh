import React, { memo } from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';

interface InfoCardProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const InfoCard: React.FC<InfoCardProps> = memo(({ title, icon, children }) => {
  return (
    <div className="p-5 rounded-3xl shadow-sm transition-all duration-300 bg-card-bg border border-card-border">
      <div className="flex items-center gap-3 mb-5 pb-3 border-b border-dashed border-border-color">
        <div className="p-2 rounded-xl bg-surface-elevated text-primary">
          {icon}
        </div>
        <h3 className="text-sm font-bold uppercase tracking-wider font-['Noto_Sans_Bengali'] text-text-primary">
          {title}
        </h3>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
});

InfoCard.displayName = 'InfoCard';

interface InfoRowProps {
  label: string;
  value?: string | number | null;
  isVerified?: boolean;
}

export const InfoRow: React.FC<InfoRowProps> = memo(({ label, value, isVerified }) => {
  const { t } = useLanguage();
  return <div className="flex justify-between items-center group">
    <span className="text-sm font-medium font-['Noto_Sans_Bengali'] transition-colors text-text-secondary">
      {label}
    </span>
    <div className="text-right flex items-center gap-2">
      <span className={`text-sm font-semibold font-['Noto_Sans_Bengali'] ${value ? 'text-text-primary' : 'text-text-secondary'}`}>
        {value || t('profile.notProvided')}
      </span>
      {isVerified && (
        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wide font-['Noto_Sans_Bengali'] bg-badge-bg text-badge-text">
          {t('profile.verified')}
        </span>
      )}
    </div>
  </div>
  ;
});

InfoRow.displayName = 'InfoRow';
