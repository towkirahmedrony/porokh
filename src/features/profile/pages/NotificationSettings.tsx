import React from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { BackButton } from '@/shared/components/ui/BackButton';
import NotificationPreferencesCard from '@/features/notifications/components/NotificationPreferencesCard';

const NotificationSettings: React.FC = () => {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const bn = language === 'bn';

  return (
    <div className={`min-h-screen bg-app ${bn ? "font-['Noto_Sans_Bengali']" : 'font-sans'}`}>
      <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-border-color bg-app/95 px-4 backdrop-blur">
        <BackButton />
        <h1 className="text-xl font-semibold leading-7 text-text-primary">
          {t('settings.notifications')}
        </h1>
      </header>

      <main className="mx-auto w-full max-w-[640px] px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-5">
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-semibold tracking-wide text-text-secondary">
            {t('notification.title')}
          </h2>
          <div className="overflow-hidden rounded-xl border border-card-border bg-card-bg px-4">
            {user?.id ? <NotificationPreferencesCard userId={user.id} /> : null}
          </div>
        </section>
      </main>
    </div>
  );
};

export default NotificationSettings;
