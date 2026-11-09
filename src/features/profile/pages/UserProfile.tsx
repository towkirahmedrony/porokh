import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { getCurrentUserProfile } from '../services/profileService';
import type { UserProfileData } from '../types/profile';
import { QUERY_KEYS } from '@/shared/constants/storageKeys';
import ProfileHeader from '../components/ProfileHeader';
import MenuSection from '../components/MenuSection';
import { InfoCard, InfoRow } from '../components/InfoCard';
import { User, GraduationCap } from 'lucide-react';
import LanguageSwitcher from '@/shared/components/ui/LanguageSwitcher';
import { MyPlanCard } from '@/features/access/components/MyPlanCard';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import type { AppMessageKey } from '@/shared/i18n/messages';
import { localizeAcademicGroup, localizeClassLevel, localizeEducationBoard } from '../utils/profileLabels';

const getGenderText = (g: string | undefined, t: TranslateFn) => {
  if (g === 'Male') return t('profile.genderMale');
  if (g === 'Female') return t('profile.genderFemale');
  return g;
};

type TranslateFn = (key: AppMessageKey) => string;

const UserProfile: React.FC = () => {
  const { user: authUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { language, t } = useLanguage();

  // ডাটাবেজ থেকে সবসময় ফ্রেশ প্রোফাইল ডাটা ফেচ করা
  const { data: profileData } = useQuery({
    queryKey: [...QUERY_KEYS.USER_PROFILE, authUser?.id ?? null],
    queryFn: getCurrentUserProfile,
    enabled: !authLoading && !!authUser?.id,
  });

  // Never render cached profile data belonging to a different signed-in user.
  const user: UserProfileData | null = profileData && authUser && profileData.id === authUser.id
    ? profileData
    : authUser
      ? {
          id: authUser.id,
          full_name: authUser.full_name ?? undefined,
          username: authUser.username ?? undefined,
          avatar_url: authUser.avatar_url ?? undefined,
          email: authUser.email ?? undefined,
          user_metadata: authUser.user_metadata,
        }
      : null;

  return (
    <div className={`container mx-auto px-4 py-6 space-y-6 animate-in fade-in duration-300 pb-24 bg-app text-text-primary ${language === 'bn' ? "font-['Noto_Sans_Bengali']" : 'font-sans'}`}>
      <div className="flex justify-end">
        <LanguageSwitcher />
      </div>
      
      {/* Profile Header */}
      <ProfileHeader 
        user={user} 
        onEdit={() => navigate('/edit-profile')} 
      />

      <MyPlanCard />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side (Desktop) / Top (Mobile): Account & Personal Details */}
        <div className="lg:col-span-2 space-y-6 order-1">
          
          <InfoCard title={t('profile.personalDetails')} icon={<User size={18} />}>
            <InfoRow 
              label={t('profile.infoName')}
              value={user?.full_name || user?.user_metadata?.full_name} 
            />
            <InfoRow 
              label={t('profile.fieldUsername')}
              value={user?.username ? `@${user.username}` : undefined} 
            />
            <InfoRow 
              label={t('profile.fieldEmail')}
              value={user?.email || user?.user_metadata?.email} 
              isVerified={user?.is_email_verified || user?.user_metadata?.email_verified} 
            />
            <InfoRow 
              label={t('profile.fieldGender')}
              value={getGenderText(user?.gender, t)}
            />
            <InfoRow 
              label={t('profile.fieldDateOfBirth')}
              value={user?.date_of_birth} 
            />
            <InfoRow 
              label={t('profile.fieldGuardianPhone')}
              value={user?.guardian_phone} 
            />
            <InfoRow 
              label={t('profile.fieldAddress')}
              value={user?.address ? String(user?.address?.full_address || user?.address) : undefined} 
            />
          </InfoCard>

          <InfoCard title={t('profile.sectionAcademic')} icon={<GraduationCap size={18} />}>
            <InfoRow 
              label={t('profile.fieldInstitution')}
              value={user?.institution} 
            />
            <InfoRow 
              label={t('profile.fieldClassInfo')}
              value={user?.class_level ? localizeClassLevel(user.class_level, language) : undefined}
            />
            <InfoRow 
              label={t('profile.fieldGroup')}
              value={user?.group ? localizeAcademicGroup(user.group, language) : undefined}
            />
            <InfoRow 
              label={t('profile.batchInfo')}
              value={user?.batch_year} 
            />
            <InfoRow 
              label={t('profile.boardInfo')}
              value={user?.education_board ? localizeEducationBoard(user.education_board, language) : undefined}
            />
            <InfoRow 
              label={t('profile.fieldStudyGoal')}
              value={user?.study_goal} 
            />
          </InfoCard>

        </div>

        {/* Right Side (Desktop) / Bottom (Mobile): Navigation Menu */}
        <div className="lg:col-span-1 order-2 lg:order-2">
          <MenuSection />
        </div>
        
      </div>
    </div>
  );
};

export default UserProfile;
