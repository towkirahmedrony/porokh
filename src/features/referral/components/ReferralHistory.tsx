import React from 'react';
import { UserPlus, Clock, CheckCircle2 } from 'lucide-react';
import { ReferralHistoryItem } from '../types/referral';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { LOCALE_BY_LANGUAGE, localizeDigits } from '@/shared/i18n/messages';

interface HistoryProps {
  history: ReferralHistoryItem[];
  isLoading: boolean;
}

export const ReferralHistory: React.FC<HistoryProps> = ({ history, isLoading }) => {
  const { t, language } = useLanguage();
  if (isLoading) {
    return <div className="h-40 rounded-xl animate-pulse bg-secondary" />;
  }

  if (!history || history.length === 0) {
    return (
      <div className="p-6 rounded-xl border border-dashed border-border-color flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-3 text-text-secondary">
          <UserPlus size={24} />
        </div>
        <h4 className="text-sm font-semibold text-text-primary mb-1">{t('referral.emptyTitle')}</h4>
        <p className="text-xs text-text-secondary max-w-xs">
          {t('referral.emptyDesc')}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card-bg border border-card-border overflow-hidden shadow-sm">
      <div className="p-3 px-4 border-b border-border-color flex items-center justify-between bg-surface">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          {t('referral.invitedSquad')}
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-badge-bg text-badge-text">
            {localizeDigits(history.length, language)}
          </span>
        </h3>
      </div>

      {/* Scrollable Container */}
      <div className="divide-y divide-border-color max-h-[260px] overflow-y-auto hide-scrollbar">
        {history.map((item) => {
          const initial = item.user.full_name?.charAt(0)?.toUpperCase() || '?';
          const joinedDate = item.user.joined_at
            ? new Date(item.user.joined_at).toLocaleDateString(LOCALE_BY_LANGUAGE[language], { month: 'short', day: 'numeric' })
            : t('referral.unknownDate');
          const isActive = item.user.status === 'active';

          return (
            <div key={item.user.id} className="p-3 flex items-center justify-between hover:bg-surface transition-colors">

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 text-xs rounded-full flex items-center justify-center font-bold overflow-hidden shrink-0 bg-secondary text-text-secondary border border-border-color">
                  {item.user.avatar_url ? (
                    <img src={item.user.avatar_url} alt={item.user.full_name} className="w-full h-full object-cover"/>
                  ) : (
                    initial
                  )}
                </div>
                <div>
                  <p className="font-medium text-sm text-text-primary leading-none">
                    {item.user.full_name || t('referral.unknownName')}
                  </p>
                  <p className="text-[10px] text-text-secondary mt-1">
                    {joinedDate}
                  </p>
                </div>
              </div>

              <div className="text-right flex flex-col items-end gap-1">
                <span className={`flex items-center gap-1 text-sm font-semibold ${isActive ? 'text-green-600' : 'text-text-secondary'}`}>
                  +{localizeDigits(item.bonus_amount, language)} <span className="text-[10px] font-normal">{t('referral.coins')}</span>
                </span>
                {isActive ? (
                  <span className="flex items-center gap-1 text-[9px] text-green-600/80 font-medium px-1 rounded bg-green-600/10">
                    <CheckCircle2 size={8} /> {t('referral.completed')}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[9px] text-yellow-600 font-medium px-1 rounded bg-yellow-500/10">
                    <Clock size={8} /> {t('referral.pending')}
                  </span>
                )}
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
};
