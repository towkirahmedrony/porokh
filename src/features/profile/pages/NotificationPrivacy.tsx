import React from 'react';
import { ChevronRight, FileText, HelpCircle, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { BackButton } from '@/shared/components/ui/BackButton';
import NotificationPreferencesCard from '@/features/notifications/components/NotificationPreferencesCard';
import NativeNotificationSettingsCard from '@/features/notifications/components/NativeNotificationSettingsCard';

const NotificationPrivacy: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const bn = language === 'bn';

  return (
    <div className={`min-h-screen bg-app ${bn ? "font-['Noto_Sans_Bengali']" : 'font-sans'}`}>
      <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-border-color bg-app/95 px-4 backdrop-blur">
        <BackButton />
        <h1 className="text-xl font-semibold leading-7 text-text-primary">
          {bn ? 'নোটিফিকেশন ও প্রাইভেসি' : 'Notifications & privacy'}
        </h1>
      </header>

      <main className="mx-auto w-full max-w-[640px] space-y-7 px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-5">
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-semibold tracking-wide text-text-secondary">
            {bn ? 'নোটিফিকেশন' : 'Notifications'}
          </h2>
          <div className="overflow-hidden rounded-xl border border-card-border bg-card-bg px-4">
            {user?.id ? <NativeNotificationSettingsCard /> : null}
            {user?.id ? <NotificationPreferencesCard userId={user.id} /> : null}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="px-1 text-xs font-semibold tracking-wide text-text-secondary">
            {bn ? 'প্রাইভেসি ও লিগাল' : 'Privacy & legal'}
          </h2>
          <div className="overflow-hidden rounded-xl border border-card-border bg-card-bg">
            <PrivacyRow icon={<Shield size={20} />} label={t('settings.privacy')} onClick={() => navigate('/privacy-policy')} />
            <PrivacyRow icon={<FileText size={20} />} label={t('profile.terms')} onClick={() => navigate('/terms-conditions')} />
            <PrivacyRow icon={<HelpCircle size={20} />} label={t('profile.dataDeletion')} onClick={() => navigate('/data-deletion')} last />
          </div>
        </section>
      </main>
    </div>
  );
};

const PrivacyRow = ({ icon, label, onClick, last = false }: { icon: React.ReactNode; label: string; onClick: () => void; last?: boolean }) => (
  <button type="button" onClick={onClick} className={`flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left text-text-primary transition-colors hover:bg-surface-elevated ${last ? '' : 'border-b border-card-border'}`}>
    <span className="text-primary" aria-hidden="true">{icon}</span>
    <span className="flex-1 text-[15px] leading-[1.5]">{label}</span>
    <ChevronRight size={18} className="text-text-secondary" aria-hidden="true" />
  </button>
);

export default NotificationPrivacy;
