import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/shared/lib/supabase';
import { PASSWORD_RECOVERY_REDIRECT_PATH } from '../utils/passwordRecovery';
import { hasRecentPasswordRecoverySession } from '../utils/passwordRecoverySession';
import { useLanguage } from '@/shared/i18n/LanguageProvider';

function getProviderError(): string | null {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return query.get('error_description') ?? query.get('error') ??
    hash.get('error_description') ?? hash.get('error');
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    const completeCallback = async () => {
      try {
        if (getProviderError()) throw new Error('OAuth was not completed');

        // Supabase JS detects and exchanges the PKCE callback URL during client
        // initialization; getSession waits for that initialization to finish.
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) throw new Error('No authenticated session');

        if (!active) return;

        // A recovery link pointed at the callback route: send it to the reset
        // screen instead of the dashboard so the user can set a password.
        if (hasRecentPasswordRecoverySession(data.session)) {
          window.history.replaceState(null, '', window.location.pathname);
          navigate(PASSWORD_RECOVERY_REDIRECT_PATH, { replace: true });
          return;
        }

        window.history.replaceState(null, '', window.location.pathname);
        // The onboarding gate sends users who already finished straight home.
        navigate('/onboarding', { replace: true });
      } catch {
        if (active) {
          window.history.replaceState(null, '', window.location.pathname);
          setFailed(true);
        }
      }
    };

    void completeCallback();
    return () => { active = false; };
  }, [navigate]);

  if (failed) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-app text-text-primary p-6 text-center">
        <h1 className="text-xl font-bold mb-2">{t('auth.callback.failedTitle')}</h1>
        <p className="text-sm text-text-secondary mb-6">{t('auth.callback.failedBody')}</p>
        <Link to="/auth/login" className="rounded-xl bg-primary px-5 py-3 font-medium text-primary-foreground">
          {t('auth.callback.backToLogin')}
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-app text-text-primary p-6" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-sm">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        <span>{t('auth.callback.completing')}</span>
      </div>
    </main>
  );
}
