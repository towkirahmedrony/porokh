import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit3, Coins, ShieldCheck } from 'lucide-react';
import { UserProfileData } from '../types/profile';
import { PROFILE_DEFAULTS } from '../utils/profileConstants';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';

interface ProfileHeaderProps {
  user: UserProfileData | any; 
  onEdit: () => void;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = memo(({ user, onEdit }) => {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const userCoins = user?.coin_balance || 0;
  
  // Data fallbacks
  const fullName = user?.full_name || user?.user_metadata?.full_name || t('profile.anonymousUser');
  const avatarUrl = user?.avatar_url || user?.user_metadata?.avatar_url || PROFILE_DEFAULTS.AVATAR_URL;
const bio = user?.bio || t('profile.bioPlaceholder');

  return (
    <div className="relative pt-10 pb-8 px-6 rounded-3xl shadow-sm flex flex-col items-center overflow-hidden transition-all duration-300 bg-card-bg border border-card-border">
      {/* Background Subtle Gradient */}
      <div className="absolute top-0 left-0 w-full h-24 opacity-20 pointer-events-none bg-gradient-to-b from-primary to-transparent" />

      {/* Coin Badge - Clickable to navigate to Marketplace */}
      <button 
        onClick={() => navigate('/dashboard/marketplace')}
title={t('profile.goToMarketplace')}
        className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-xs shadow-sm font-['Noto_Sans_Bengali'] cursor-pointer transition-transform hover:scale-105 active:scale-95 bg-surface-elevated text-text-primary border border-border-color backdrop-blur-sm"
      >
        <Coins size={14} style={{ color: '#F59E0B' }} />
        <span>{localizeDigits(userCoins, language)}</span>
      </button>

      <div className="relative z-10 mt-2">
        <div className="relative p-1 rounded-full bg-surface-elevated">
          <img 
            src={avatarUrl} 
            alt={fullName} 
            className="w-24 h-24 rounded-full object-cover shadow-md border-4 border-surface"
          />
          {user?.subscription_status === 'active' && (
            <span className="absolute bottom-1 right-0 text-[10px] font-bold px-2 py-0.5 rounded-full border-2 shadow-sm bg-primary text-primary-foreground border-surface">
              PRO
            </span>
          )}
        </div>
      </div>
      
      <div className="text-center mt-4 relative z-10">
        <h1 className="text-2xl font-bold flex items-center justify-center gap-2 font-['Noto_Sans_Bengali'] text-text-primary">
          {fullName}
          {user?.is_phone_verified && (
<span title={t('profile.verified')} className="inline-flex">
              <ShieldCheck size={18} className="text-green-500" />
            </span>
          )}
        </h1>
        <p className="text-sm mt-1 font-['Noto_Sans_Bengali'] font-medium text-text-secondary">
          {bio}
        </p>
      </div>

      {/* Action Area */}
      <div className="flex items-center gap-4 mt-6 relative z-10 w-full justify-center">
        <button 
          onClick={onEdit}
          className="flex items-center gap-2 px-8 py-2.5 text-sm rounded-2xl font-bold shadow-md transition-all active:scale-95 hover:opacity-90 font-['Noto_Sans_Bengali'] bg-primary text-primary-foreground"
        >
          <Edit3 size={16} />
          {t('profile.editProfile')}
        </button>
      </div>
    </div>
  );
});

ProfileHeader.displayName = 'ProfileHeader';

export default ProfileHeader;
