import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ProfileHero from '../components/public/ProfileHero';
import VersusStats from '../components/public/VersusStats';
import ActivityChart from '../components/public/ActivityChart';
import BadgeShowcase from '../components/public/BadgeShowcase';
import SkillRadar from '../components/public/SkillRadar'; 
import PvpStats from '../components/public/PvpStats';
import { ChevronLeft } from 'lucide-react';
import { ProfileSkeleton } from '../components/public/ProfileSkeleton';
import { ChallengeSetupModal } from '../../exam/components/ChallengeSetupModal';
import { getPublicProfileData, PublicProfileResponse } from '../services/profileService';
import { useAuth } from '../../auth/hooks/useAuth';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import Lottie from 'lottie-react';
import userNotFoundAnimation from '@/assets/animations/user-not-found.json';

const PublicProfile: React.FC = () => {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);

  const { 
    data: profileData, 
    isLoading: loading, 
    error: queryError 
  } = useQuery<PublicProfileResponse, Error>({
    queryKey: ['publicProfile', id, user?.id],
    queryFn: () => getPublicProfileData(id as string, user?.id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const error = queryError?.message;

  const handleChallenge = useCallback(() => setIsChallengeModalOpen(true), []);
  const handleCloseModal = useCallback(() => setIsChallengeModalOpen(false), []);
  const handleGoBack = useCallback(() => navigate(-1), [navigate]);

  if (loading) return <ProfileSkeleton />;

  if (error || !profileData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center animate-in fade-in duration-500 bg-app">
        <div className="w-64 h-64 mb-4">
          <Lottie animationData={userNotFoundAnimation} loop={true} />
        </div>
        <p className="font-['Noto_Sans_Bengali'] text-lg font-medium mb-6 text-text-primary">
          {t('profile.loadError')}
        </p>
        <button onClick={handleGoBack} className="flex items-center gap-2 px-6 py-2.5 rounded-full font-['Noto_Sans_Bengali'] shadow-md active:scale-95 bg-primary text-primary-foreground">
<ChevronLeft className="w-5 h-5" /> {t('common.back')}
        </button>
      </div>
    );
  }

  const profile = profileData;
  const activityData = profileData.activity;
  const versusStats = (profileData as any).versusStats; 
  
  const isOwnProfile = user?.id === profile.id || (user as any)?.username === (profile as any).username;
  const opponentFirstName = profile.full_name?.split(' ')[0] || t('exam.opponent');

  return (
    <div className="min-h-screen pb-10 animate-in fade-in duration-500 bg-app">
      <button onClick={handleGoBack} className="absolute top-4 left-4 z-20 p-2 rounded-full backdrop-blur-sm shadow-sm bg-surface-elevated text-text-primary border border-border-color">
        <ChevronLeft className="w-6 h-6" />
      </button>

      <ProfileHero 
        profile={profile} 
        onChallenge={handleChallenge} 
        isOwnProfile={isOwnProfile} 
      />

      {!isOwnProfile && versusStats && (
        <VersusStats stats={versusStats} opponentName={opponentFirstName} />
      )}

      {/* 🟢 পিভিপি স্ট্যাটস এখন ইউজারের ডেটা সহ পাস হচ্ছে */}
      <PvpStats 
        myStats={user as any} 
        theirStats={profile as any} 
        opponentName={opponentFirstName} 
        isOwnProfile={isOwnProfile}
      />

      {profile.top_skills && profile.top_skills.length > 0 && (
        <SkillRadar data={profile.top_skills} />
      )}

      {activityData && (
        <ActivityChart 
          data={activityData} 
          opponentName={opponentFirstName} 
          isOwnProfile={isOwnProfile} 
        />
      )}

      {profile.badges && <BadgeShowcase badges={profile.badges} />}

      <ChallengeSetupModal isOpen={isChallengeModalOpen} onClose={handleCloseModal} opponentId={profile.id} opponentName={profile.full_name || t('exam.opponent')} />
    </div>
  );
};

export default PublicProfile;
