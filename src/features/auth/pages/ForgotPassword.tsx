import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '@/shared/lib/supabase';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import type { AppMessageKey } from '@/shared/i18n/messages';
import {
  PASSWORD_RECOVERY_PUBLIC_MESSAGE_KEY,
  requestPasswordRecovery,
} from '../utils/passwordRecovery';

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; key: AppMessageKey } | null>(null);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setMessage(null);

    const inputEmail = email.trim();
    if (!inputEmail) {
      setMessage({ type: 'error', key: 'auth.forgot.emailRequired' });
      return;
    }

    setIsLoading(true);
    try {
      await requestPasswordRecovery(inputEmail, supabase.auth, window.location.origin);
      setMessage({ type: 'success', key: PASSWORD_RECOVERY_PUBLIC_MESSAGE_KEY });
      setEmail('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-app text-text-primary p-4 justify-center items-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-3 text-text-primary">{t('auth.forgotPassword')}</h1>
          <p className="text-text-secondary text-sm leading-relaxed px-4">
            {t('auth.forgot.description')}
          </p>
        </div>

        {message && (
          <div className="mb-6 p-4 rounded-xl flex items-start gap-3 text-sm border bg-surface-elevated border-border-color text-text-primary" role="status" aria-live="polite">
            {message.type === 'success' ? (
              <CheckCircle size={20} className="shrink-0 mt-0.5 text-text-primary" aria-hidden="true" />
            ) : (
              <AlertCircle size={20} className="shrink-0 mt-0.5 text-text-primary" aria-hidden="true" />
            )}
            <p className="leading-relaxed">{t(message.key)}</p>
          </div>
        )}

        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.field.emailAddress')}
              className="w-full bg-input-bg border border-input-border rounded-xl px-4 py-3.5 text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-focus-ring transition-colors"
              disabled={isLoading}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !email.trim()}
            className="w-full bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed font-medium py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" aria-label={t('common.loading')} />
            ) : (
              t('auth.forgot.sendResetLink')
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft size={18} />
            <span>{t('auth.back')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
