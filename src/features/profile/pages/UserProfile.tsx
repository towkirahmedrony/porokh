import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  ChevronRight,
  Gift,
  HelpCircle,
  Languages,
  Lock,
  LogOut,
  Moon,
  Settings,
  Store,
  Sun,
  User,
  Users,
} from 'lucide-react';
import { useAuth } from '../../auth/hooks/useAuth';
import { getCurrentUserProfile } from '../services/profileService';
import type { UserProfileData } from '../types/profile';
import { QUERY_KEYS } from '@/shared/constants/storageKeys';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import { localizeClassLevel } from '../utils/profileLabels';
import { useTheme } from '@/shared/hooks/useTheme';
import useAccess from '@/features/access/hooks/useAccess';
import ConfirmModal from '@/shared/components/feedback/ConfirmModal';
import { Skeleton } from '@/shared/components/ui/Skeleton';

const completionFields: Array<keyof UserProfileData> = [
  'full_name',
  'gender',
  'date_of_birth',
  'guardian_phone',
  'address',
  'institution',
  'class_level',
  'group',
  'batch_year',
  'education_board',
  'study_goal',
];

const hasValue = (value: unknown) => {
  if (typeof value === 'string') return value.trim().length > 0;
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(hasValue);
  }
  return Boolean(value);
};

const ProfileSkeleton = () => (
  <div className="mx-auto max-w-2xl space-y-5" aria-label="Profile loading">
    <div className="flex items-center justify-between"><Skeleton className="h-7 w-28" /><Skeleton className="h-10 w-10 rounded-full" /></div>
    <div className="rounded-xl border border-card-border bg-card-bg p-5"><div className="flex items-center gap-4"><Skeleton className="h-[72px] w-[72px] rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-56" /><div className="flex gap-2"><Skeleton className="h-7 w-16 rounded-full" /><Skeleton className="h-7 w-20 rounded-full" /></div></div></div></div>
    <Skeleton className="h-24 w-full rounded-xl" />
    <Skeleton className="h-28 w-full rounded-xl" />
  </div>
);

type RowProps = { icon: React.ReactNode; label: string; value?: string; onClick?: () => void; trailing?: React.ReactNode; danger?: boolean };

const AccountRow = ({ icon, label, value, onClick, trailing, danger = false }: RowProps) => (
  <button type="button" onClick={onClick} className="flex min-h-12 w-full items-center gap-3 border-b border-card-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
    <span className={danger ? 'text-danger' : 'text-primary'} aria-hidden="true">{icon}</span>
    <span className={`flex-1 font-['Noto_Sans_Bengali'] text-[15px] leading-[1.5] ${danger ? 'text-danger' : 'text-text-primary'}`}>{label}</span>
    {value && <span className="font-['Noto_Sans_Bengali'] text-sm text-text-secondary">{value}</span>}
    {trailing ?? <ChevronRight size={18} className="text-text-secondary" aria-hidden="true" />}
  </button>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h2 className="px-1 font-['Noto_Sans_Bengali'] text-xs font-semibold tracking-wide text-text-secondary">{title}</h2>
    <div className="overflow-hidden rounded-xl border border-card-border bg-card-bg">{children}</div>
  </section>
);

const UserProfile: React.FC = () => {
  const { user: authUser, loading: authLoading, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { language, t, setLanguage } = useLanguage();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { access, examFeature, isLoading: accessLoading } = useAccess();
  const [logoutOpen, setLogoutOpen] = useState(false);

  const profileQuery = useQuery({
    queryKey: [...QUERY_KEYS.USER_PROFILE, authUser?.id ?? null],
    queryFn: getCurrentUserProfile,
    enabled: !authLoading && !!authUser?.id,
  });

  const user: UserProfileData | null = profileQuery.data && authUser && profileQuery.data.id === authUser.id
    ? profileQuery.data
    : authUser
      ? { id: authUser.id, full_name: authUser.full_name ?? undefined, username: authUser.username ?? undefined, avatar_url: authUser.avatar_url ?? undefined, email: authUser.email ?? undefined, user_metadata: authUser.user_metadata }
      : null;

  const completion = useMemo(() => {
    if (!user) return 0;
    const filled = completionFields.filter((field) => hasValue(user[field])).length;
    return Math.round((filled / completionFields.length) * 100);
  }, [user]);

  const name = user?.full_name || user?.user_metadata?.full_name || t('profile.anonymousUser');
  const avatarUrl = user?.avatar_url || user?.user_metadata?.avatar_url;
  const initials = name.trim().charAt(0).toUpperCase() || 'P';
  const subtitle = [
    user?.username ? `@${user.username}` : null,
    user?.class_level ? localizeClassLevel(user.class_level, language) : null,
    user?.study_goal || null,
  ].filter(Boolean).join(' · ');
  const streak = user?.current_streak ?? 0;
  const examUsage = examFeature?.unlimited ? '∞' : examFeature ? `${localizeDigits(examFeature.used, language)} / ${localizeDigits(examFeature.limit, language)}` : '—';
  const expiry = access?.premium_expires_at ? new Date(access.premium_expires_at).toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  const isDark = resolvedTheme === 'dark';
  const copy = language === 'bn'
    ? { profile: 'প্রোফাইল', complete: 'সম্পূর্ণ করুন', plan: 'আমার প্ল্যান', free: 'ফ্রি প্ল্যান', today: 'আজকের ব্যবহার', expires: 'মেয়াদ', upgrade: 'আপগ্রেড', offers: 'আয় ও অফার', account: 'অ্যাকাউন্ট', help: 'সহায়তা', personal: 'ব্যক্তিগত ও একাডেমিক তথ্য', language: 'ভাষা', dark: 'ডার্ক মোড', enabled: 'চালু', notification: 'নোটিফিকেশন ও প্রাইভেসি', helpLegal: 'হেল্প ও লিগাল', logout: 'লগ আউট', version: 'সংস্করণ', loadError: 'প্রোফাইল লোড করা যায়নি। আবার চেষ্টা করুন।', retry: 'আবার চেষ্টা করুন' }
    : { profile: 'Profile', complete: 'Complete profile', plan: 'My plan', free: 'Free plan', today: "Today's usage", expires: 'Expires', upgrade: 'Upgrade', offers: 'Income & offers', account: 'Account', help: 'Help', personal: 'Personal & academic information', language: 'Language', dark: 'Dark mode', enabled: 'On', notification: 'Notifications & privacy', helpLegal: 'Help & legal', logout: 'Log out', version: 'Version', loadError: 'Could not load your profile. Please try again.', retry: 'Try again' };

  if (authLoading || (profileQuery.isLoading && !user)) return <ProfileSkeleton />;
  if (!user || profileQuery.isError) {
    return <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-3 text-center"><p className="font-['Noto_Sans_Bengali'] text-text-secondary">{copy.loadError}</p><button type="button" onClick={() => { void profileQuery.refetch(); refreshProfile(); }} className="rounded-lg bg-primary px-4 py-2 font-['Noto_Sans_Bengali'] text-sm font-semibold text-primary-foreground">{copy.retry}</button></div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-28 font-['Noto_Sans_Bengali']">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold leading-[1.45] text-text-primary">{copy.profile}</h1>
        <button type="button" onClick={() => navigate('/settings')} className="rounded-full p-2 text-text-secondary transition-colors hover:bg-surface-elevated" aria-label={t('settings.title')}><Settings size={21} /></button>
      </header>

      <section className="rounded-xl border border-card-border bg-card-bg p-4">
        <button type="button" onClick={() => navigate('/edit-profile')} className="flex w-full items-center gap-4 text-left">
          <span className="grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-full bg-blue-600 text-3xl font-semibold text-white shadow-sm">
            {avatarUrl ? <img src={avatarUrl} alt={t('profile.avatarAlt')} className="h-full w-full object-cover" /> : initials}
          </span>
          <span className="min-w-0 flex-1"><strong className="block truncate text-xl font-semibold leading-[1.45] text-text-primary">{name}</strong><span className="block truncate text-sm leading-[1.55] text-text-secondary">{subtitle || t('profile.fieldUsername')}</span><span className="mt-2 flex flex-wrap gap-2"><span className="rounded-full bg-badge-bg px-3 py-1 text-xs font-semibold text-badge-text">{localizeDigits(user.total_xp ?? 0, language)} XP</span><span className="rounded-full bg-warning/15 px-3 py-1 text-xs font-semibold text-warning">{localizeDigits(streak, language)} {language === 'bn' ? 'দিন স্ট্রিক' : 'day streak'}</span></span></span>
        </button>
      </section>

      {completion < 100 && <button type="button" onClick={() => navigate('/edit-profile')} className="w-full rounded-xl border border-card-border bg-card-bg p-4 text-left transition-colors hover:bg-surface-elevated"><div className="mb-2 flex items-center justify-between gap-3"><span className="text-sm font-semibold text-text-primary">{language === 'bn' ? `প্রোফাইল ${localizeDigits(completion, language)}% সম্পূর্ণ` : `Profile ${completion}% complete`}</span><span className="text-sm font-semibold text-primary">{copy.complete}</span></div><div className="h-2 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${completion}%` }} /></div></button>}

      <section className="rounded-xl border border-card-border bg-card-bg p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-text-secondary">{copy.plan}</p><h2 className="mt-1 text-lg font-semibold text-text-primary">{access?.premium ? access.tier : copy.free}</h2><p className="mt-1 text-sm text-text-secondary">{copy.today}: {examUsage}</p>{expiry && <p className="mt-1 text-xs text-text-secondary">{copy.expires}: {expiry}</p>}</div><button type="button" onClick={() => navigate('/premium')} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">{copy.upgrade}</button></div>{accessLoading && <div className="mt-3 h-1.5 animate-pulse rounded-full bg-surface" />}</section>

      <Section title={copy.offers}><AccountRow icon={<Gift size={20} />} label={t('profile.referral')} onClick={() => navigate('/referral')} /><AccountRow icon={<Store size={20} />} label={t('profile.marketplace')} onClick={() => navigate('/dashboard/marketplace')} /></Section>
      <Section title={copy.account}><AccountRow icon={<User size={20} />} label={copy.personal} onClick={() => navigate('/edit-profile')} /><AccountRow icon={<Lock size={20} />} label={t('profile.changePassword')} onClick={() => navigate('/change-password')} /><AccountRow icon={<Languages size={20} />} label={copy.language} value={language === 'bn' ? 'বাংলা' : 'English'} onClick={() => setLanguage(language === 'bn' ? 'en' : 'bn')} /><AccountRow icon={isDark ? <Moon size={20} /> : <Sun size={20} />} label={copy.dark} value={isDark ? copy.enabled : ''} onClick={toggleTheme} trailing={<span className={`relative h-6 w-11 rounded-full p-1 transition-colors ${isDark ? 'bg-primary' : 'bg-surface-elevated border border-border-color'}`}><span className={`block h-4 w-4 rounded-full bg-surface shadow-sm transition-transform ${isDark ? 'translate-x-5' : ''}`}><span className="sr-only">{copy.dark}</span></span></span>} /></Section>
      <Section title={copy.help}><AccountRow icon={<Bell size={20} />} label={copy.notification} onClick={() => navigate('/settings')} /><AccountRow icon={<Users size={20} />} label={t('profile.supportCenter')} onClick={() => navigate('/support')} /><AccountRow icon={<HelpCircle size={20} />} label={copy.helpLegal} onClick={() => navigate('/faq')} /></Section>

      <button type="button" onClick={() => setLogoutOpen(true)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-danger/40 px-4 py-3 font-semibold text-danger transition-colors hover:bg-danger/10"><LogOut size={18} />{copy.logout}</button>
      <p className="text-center text-xs text-text-secondary">{copy.version} 1.0.5</p>
      <ConfirmModal isOpen={logoutOpen} title={t('settings.logoutConfirmTitle')} message={t('settings.logoutConfirmBody')} onCancel={() => setLogoutOpen(false)} onConfirm={async () => { await signOut?.(); setLogoutOpen(false); }} confirmText={t('profile.logout')} cancelText={t('common.cancel')} />
    </div>
  );
};

export default UserProfile;
