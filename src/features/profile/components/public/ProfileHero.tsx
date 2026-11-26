import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Swords } from 'lucide-react';
import { PROFILE_DEFAULTS } from '../../utils/profileConstants';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import { formatStudentAcademicLabel } from '@/shared/lib/academic';

export interface PublicProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  total_xp: number | null;
  pvp_rating: number | null;
  institution?: string | null;
  hsc_batch?: string | null;
  study_goal?: string | null;
}

interface ProfileHeroProps {
  profile: PublicProfile;
  onChallenge: () => void;
  isOwnProfile?: boolean;
}

const ProfileHero: React.FC<ProfileHeroProps> = ({ profile, onChallenge, isOwnProfile = false }) => {
  const { language, t } = useLanguage();
  const academicLabel = formatStudentAcademicLabel(
    { hsc_batch: profile.hsc_batch, study_goal: profile.study_goal },
    language
  );

  return (
    <div className="relative pb-8 pt-6 px-4 overflow-hidden rounded-b-[2rem] border-b bg-app border-border-color">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-[80px] pointer-events-none bg-primary/15"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center text-center relative z-10"
      >
        <div className="relative mb-4">
          <div className="w-28 h-28 rounded-full p-1 bg-gradient-to-tr from-primary to-accent">
            <img 
              src={profile.avatar_url || '/avatars/default-avatar.webp'} 
              alt={profile.full_name || t('profile.avatarAlt')}
              className="w-full h-full rounded-full object-cover border-[3px] border-card-bg"
            />
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold shadow-md flex items-center border bg-card-bg border-border-color text-accent">
            <Shield className="w-3 h-3 mr-1 fill-current" />
            <span className="font-['Noto_Sans_Bengali']">
              {t('profile.ratingLabel')} {localizeDigits(profile.pvp_rating || PROFILE_DEFAULTS.RATING, language)}
            </span>
          </div>
        </div>

        <h1 className="text-2xl font-bold mb-1 font-['Noto_Sans_Bengali'] text-text-primary">
          {profile.full_name || t('profile.anonymousUser')}
        </h1>

        {/* Batch and goal, through the shared helper: never a raw value. */}
        {(profile.institution || academicLabel) && (
          <p className="mb-1 text-sm font-medium font-['Noto_Sans_Bengali'] text-primary">
            {[profile.institution, academicLabel].filter(Boolean).join(' • ')}
          </p>
        )}

        {profile.bio ? (
          <p className="mb-5 text-sm font-['Noto_Sans_Bengali'] text-text-secondary">
            {profile.bio}
          </p>
        ) : (
          <div className="mb-5" />
        )}

        {/* 🟢 নিজের প্রোফাইল হলে ব্যাটল বাটন হাইড করা */}
        {!isOwnProfile && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onChallenge}
            className="flex items-center gap-2 px-8 py-2.5 rounded-full font-bold shadow-lg transition-all font-['Noto_Sans_Bengali'] bg-primary text-primary-foreground shadow-primary/40"
          >
            <Swords className="w-5 h-5" />
{t('profile.battle')}
          </motion.button>
        )}
      </motion.div>
    </div>
  );
};

export default ProfileHero;
