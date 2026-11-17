import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2, MailCheck } from 'lucide-react';

import { supabase } from '@/shared/lib/supabase';
import { useAuth } from '../hooks/useAuth';
import {
  clearPendingVerificationEmail,
  cooldownSecondsLeft,
  markResendSent,
  readPendingVerificationEmail,
  readResendAvailableAt,
} from '../utils/pendingVerification';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits, type AppMessageKey } from '@/shared/i18n/messages';

type Feedback = {
  tone: 'success' | 'error' | 'info';
  key: AppMessageKey;
};

const readStateEmail = (state: unknown): string => {
  if (!state || typeof state !== 'object') return '';
  const email = (state as { email?: unknown }).email;
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
};

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const navigatedRef = useRef(false);

  const [email] = useState(() => {
    const stateEmail = readStateEmail(location.state);
    return stateEmail || readPendingVerificationEmail() || user?.email || '';
  });
  const [availableAt, setAvailableAt] = useState(readResendAvailableAt);
  const [now, setNow] = useState(Date.now);
  const [isSending, setIsSending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const secondsLeft = useMemo(
    () => cooldownSecondsLeft(availableAt, now),
    [availableAt, now]
  );

  const goToOnboarding = useCallback(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    clearPendingVerificationEmail();
    navigate('/onboarding', { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (!availableAt) return;

    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [availableAt]);

  const isVerified = Boolean(user?.email_confirmed_at);

  useEffect(() => {
    if (isVerified) goToOnboarding();
  }, [goToOnboarding, isVerified]);

  const checkVerification = useCallback(
    async (showNotYet: boolean) => {
      setIsChecking(true);

      try {
        const { data, error } = await supabase.auth.getUser();

        if (!error && data.user?.email_confirmed_at) {
          goToOnboarding();
          return;
        }

        if (showNotYet) {
          const signedIn = Boolean(data.user) || Boolean(user?.id);
          setFeedback({
            tone: 'info',
            key: signedIn ? 'auth.verify.notYet' : 'auth.verify.loginToContinue',
          });
        }
      } catch {
        if (showNotYet) {
          setFeedback({ tone: 'error', key: 'auth.verify.notYet' });
        }
      } finally {
        setIsChecking(false);
      }
    },
    [goToOnboarding, user?.id]
  );

  useEffect(() => {
    if (!user?.id) return;

    const handleFocus = () => {
      void checkVerification(false);
    };

    const timer = window.setInterval(() => {
      void checkVerification(false);
    }, 6000);

    window.addEventListener('focus', handleFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
    };
  }, [checkVerification, user?.id]);

  const resend = async () => {
    if (!email || isSending || secondsLeft > 0) return;

    setIsSending(true);
    setFeedback(null);

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });

      if (error) {
        const message = error.message.toLowerCase();
        if (message.includes('already confirmed') || message.includes('already verified')) {
          setFeedback({ tone: 'info', key: 'auth.verify.alreadyVerified' });
        } else if (message.includes('rate limit') || message.includes('too many')) {
          setFeedback({ tone: 'error', key: 'auth.verify.tooMany' });
        } else {
          setFeedback({ tone: 'error', key: 'auth.verify.resendFailed' });
        }
        return;
      }

      const next = markResendSent();
      setAvailableAt(next);
      setNow(Date.now());
      setFeedback({ tone: 'success', key: 'auth.verify.resent' });
    } catch {
      setFeedback({ tone: 'error', key: 'auth.verify.resendFailed' });
    } finally {
      setIsSending(false);
    }
  };

  const resendLabel = isSending
    ? t('auth.verify.resending')
    : secondsLeft > 0
      ? t('auth.verify.resendIn', {
          seconds: localizeDigits(secondsLeft, language),
        })
      : t('auth.verify.resend');

  return (
    <div className="min-h-screen w-full bg-app px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[400px] flex-col justify-center">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <MailCheck className="h-8 w-8 text-primary" aria-hidden="true" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            {t('auth.verify.title')}
          </h1>

          {email ? (
            <p className="mt-2 text-[15px] leading-6 text-text-secondary">
              {t('auth.verify.sentTo', { email })}
            </p>
          ) : (
            <p className="mt-2 text-[15px] leading-6 text-text-secondary">
              {t('auth.verify.missingEmail')}
            </p>
          )}
        </div>

        {email && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border-color bg-surface px-4 py-3 text-sm leading-6 text-text-secondary">
              <p>{t('auth.verify.openLink')}</p>
              <p className="mt-1">{t('auth.verify.spam')}</p>
            </div>

            {feedback && (
              <div
                role={feedback.tone === 'error' ? 'alert' : 'status'}
                aria-live="polite"
                className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${
                  feedback.tone === 'error'
                    ? 'border-accent/40 bg-accent/10 text-accent'
                    : 'border-border-color bg-surface-elevated text-text-primary'
                }`}
              >
                {feedback.tone === 'error' ? (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                )}
                <p className="font-medium leading-5">{t(feedback.key)}</p>
              </div>
            )}

            <button
              type="button"
              onClick={() => void checkVerification(true)}
              disabled={isChecking}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3.5 text-lg font-bold text-primary-foreground transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isChecking ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : null}
              {isChecking ? t('auth.verify.checking') : t('auth.verify.iVerified')}
            </button>

            <button
              type="button"
              onClick={() => void resend()}
              disabled={isSending || secondsLeft > 0}
              className="w-full rounded-full border border-border-color bg-surface px-4 py-3 text-base font-semibold text-text-primary transition-colors hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resendLabel}
            </button>
          </div>
        )}

        <div className="mt-6 flex flex-col items-center gap-2 text-[15px]">
          <button
            type="button"
            onClick={() => {
              clearPendingVerificationEmail();
              navigate('/auth/register', { replace: true });
            }}
            className="font-bold text-text-primary transition-colors hover:text-text-secondary hover:underline"
          >
            {t('auth.verify.wrongEmail')}
          </button>

          <Link
            to="/auth/login"
            className="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary hover:underline"
          >
            {t('auth.verify.backToLogin')}
          </Link>
        </div>
      </div>
    </div>
  );
}
