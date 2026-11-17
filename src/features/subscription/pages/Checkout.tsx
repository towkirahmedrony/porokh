import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQuery, useMutation } from '@tanstack/react-query';

import { subscriptionService } from '../services/subscriptionService';
import { SubscriptionPlan, PaymentMethod } from '../types/subscription';
import PaymentMethodCard from '../components/PaymentMethodCard';
import Button from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { useAuth } from '../../auth/hooks/useAuth';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import { useAccess } from '@/features/access/hooks/useAccess';

interface LocationState {
  plan?: SubscriptionPlan;
}

type SubmitState = 'form' | 'pending' | 'success' | 'failed' | 'pending_expired';

const POLL_INTERVAL_MS = 10_000;
const MAX_POLL_MS = 5 * 60 * 1000;

const Checkout: React.FC = () => {
  const { planId } = useParams<{ planId: string }>();
  const location = useLocation();
  const state = location.state as LocationState;
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { isPremium, refresh: refreshAccess } = useAccess();

  const initialPlan = state?.plan;

  const { data: plan, isLoading: isLoadingPlan } = useQuery({
    queryKey: ['subscriptionPlan', planId],
    queryFn: () => subscriptionService.fetchPlanById(planId!),
    enabled: !!planId && !initialPlan,
    initialData: initialPlan,
  });

  const { data: paymentMethods = [], isLoading: isLoadingMethods } = useQuery({
    queryKey: ['paymentMethods'],
    queryFn: subscriptionService.getPaymentMethods,
  });

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [senderNumber, setSenderNumber] = useState('');
  const [trxId, setTrxId] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>('form');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pollStartedAt = useRef<number | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPolling = useRef(false);

  useEffect(() => {
    if (paymentMethods.length > 0 && !selectedMethod) {
      setSelectedMethod(paymentMethods[0]);
    }
  }, [paymentMethods, selectedMethod]);

  const clearPolling = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
    isPolling.current = false;
  }, []);

  // Never leave a timer running after the screen is left.
  useEffect(() => clearPolling, [clearPolling]);

  // Authoritative activation check: premium must be confirmed by /me/access.
  useEffect(() => {
    if (submitState !== 'pending') return;
    if (isPremium) {
      clearPolling();
      setSubmitState('success');
    }
  }, [submitState, isPremium, clearPolling]);

  const startPolling = useCallback(() => {
    pollStartedAt.current = Date.now();
    clearPolling();

    const tick = async () => {
      if (isPolling.current) return;
      isPolling.current = true;

      try {
        await refreshAccess();
      } catch {
        // Network errors keep the pending state; the next tick retries.
      } finally {
        isPolling.current = false;
      }

      const elapsed = Date.now() - (pollStartedAt.current ?? Date.now());
      if (elapsed >= MAX_POLL_MS) {
        setSubmitState('pending_expired');
        clearPolling();
        return;
      }

      pollTimer.current = setTimeout(tick, POLL_INTERVAL_MS);
    };

    pollTimer.current = setTimeout(tick, POLL_INTERVAL_MS);
  }, [clearPolling, refreshAccess]);

  const submitClaimMutation = useMutation({
    mutationFn: subscriptionService.submitPaymentClaim,
    onSuccess: (data: any) => {
      const status = typeof data?.status === 'string' ? data.status.toLowerCase() : null;

      if (status === 'paid') {
        void refreshAccess();
        setSubmitState('success');
        return;
      }

      if (status === 'failed' || status === 'refunded') {
        setSubmitState('failed');
        return;
      }

      // Anything else (including no status) means the payment is awaiting
      // verification: poll until premium is confirmed or the window expires.
      setSubmitState('pending');
      startPolling();
    },
    onError: (error: any) => {
      setSubmitState('failed');
      setErrorMessage(
        error?.response?.data?.message || null
      );
      toast.error(error?.response?.data?.message || t('premium.pay_failed'));
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !plan || !selectedMethod || submitClaimMutation.isPending) return;

    if (!/^01\d{9}$/.test(senderNumber)) {
      toast.error(t('premium.validation_phone'));
      return;
    }
    if (trxId.trim().length < 8) {
      toast.error(t('premium.validation_trx'));
      return;
    }

    const finalAmount =
      plan.discounted_price !== null && plan.discounted_price < plan.price
        ? plan.discounted_price
        : plan.price;

    submitClaimMutation.mutate({
      user_id: user.id,
      plan_id: plan.id,
      amount: finalAmount,
      method: selectedMethod.id,
      sender_number: senderNumber,
      trx_id: trxId.trim().toUpperCase(),
    });
  };

  const isLoading = isLoadingPlan || isLoadingMethods;

  const finalAmount = useMemo(() => {
    if (!plan) return 0;
    return plan.discounted_price !== null && plan.discounted_price < plan.price
      ? plan.discounted_price
      : plan.price;
  }, [plan]);

  if (isLoading || !plan) {
    return (
      <div className="p-10 text-center">
        <Loader2 className="mx-auto animate-spin text-primary" />
      </div>
    );
  }

  const isDiscounted = plan.discounted_price !== null && plan.discounted_price < plan.price;

  const statusPanel = () => {
    if (submitState === 'success') {
      return (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
          <CheckCircle2 className="mx-auto mb-3 text-emerald-600" size={40} />
          <p className="text-base font-semibold text-emerald-700 dark:text-emerald-400">
            {t('premium.pay_success')}
          </p>
          <Button className="mt-5 w-full" onClick={() => navigate('/dashboard', { replace: true })}>
            {t('premium.back_home')}
          </Button>
        </div>
      );
    }

    if (submitState === 'failed') {
      return (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
          <XCircle className="mx-auto mb-3 text-red-600" size={40} />
          <p className="text-base font-semibold text-red-700 dark:text-red-400">
            {t('premium.pay_failed')}
          </p>
          {errorMessage ? (
            <p className="mt-2 text-xs text-text-secondary">{errorMessage}</p>
          ) : null}
          <Button
            variant="outline"
            className="mt-5 w-full"
            onClick={() => {
              setSubmitState('form');
              setErrorMessage(null);
            }}
          >
            {t('premium.retry')}
          </Button>
        </div>
      );
    }

    if (submitState === 'pending' || submitState === 'pending_expired') {
      return (
        <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-6 text-center">
          {submitState === 'pending' ? (
            <Loader2 className="mx-auto mb-3 animate-spin text-yellow-600" size={36} />
          ) : (
            <Clock className="mx-auto mb-3 text-yellow-600" size={36} />
          )}
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
            {submitState === 'pending'
              ? t('premium.pay_pending')
              : t('premium.payment_polling_expired')}
          </p>
          <Button
            variant="outline"
            className="mt-5 w-full"
            onClick={() => {
              void refreshAccess();
              navigate('/profile', { replace: false });
            }}
          >
            {t('premium.my_plan')}
          </Button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-app p-4 text-text-primary">
      <div className="mx-auto mb-6 flex max-w-2xl items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          aria-label={t('premium.close')}
          className="rounded-full border border-card-border bg-card-bg p-2 shadow-sm"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">{t('premium.checkout')}</h1>
      </div>

      <div className="mx-auto max-w-2xl">
        <div className="mb-6 rounded-2xl border border-card-border bg-card-bg p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase text-text-secondary">
            {t('premium.order_summary')}
          </h2>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-lg font-medium">
              {language === 'en' && plan.name_en ? plan.name_en : plan.name}
            </span>
            <span className="text-lg font-bold">
              ৳{localizeDigits(plan.price, language)}
            </span>
          </div>
          {isDiscounted && (
            <div className="flex items-center justify-between text-emerald-500">
              <span>{t('premium.discount')}</span>
              <span>
                - ৳{localizeDigits(plan.price - plan.discounted_price!, language)}
              </span>
            </div>
          )}
          <div className="my-4 border-t border-dashed border-border-color" />
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold">{t('premium.total_payable')}</span>
            <span className="text-2xl font-extrabold text-primary">
              ৳{localizeDigits(finalAmount, language)}
            </span>
          </div>
        </div>

        {statusPanel()}

        {submitState === 'form' && (
          <>
            {selectedMethod && (
              <div className="mb-6 flex gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
                <AlertTriangle className="mt-0.5 shrink-0 text-yellow-600" />
                <p className="text-sm text-yellow-800">
                  {t('premium.send_money_notice')}{' '}
                  <strong className="font-mono">{selectedMethod.number}</strong> —{' '}
                  {selectedMethod.name}
                </p>
              </div>
            )}

            <div className="mb-6 grid grid-cols-2 gap-4">
              {paymentMethods.map((method) => (
                <PaymentMethodCard
                  key={method.id}
                  method={method}
                  isSelected={selectedMethod?.id === method.id}
                  onSelect={() => setSelectedMethod(method)}
                />
              ))}
            </div>

            <div className="rounded-2xl border border-card-border bg-card-bg p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-bold">{t('premium.verify_payment')}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium" htmlFor="sender-number">
                    {t('premium.sender_number')}
                  </label>
                  <Input
                    id="sender-number"
                    type="tel"
                    inputMode="numeric"
                    placeholder="01XXXXXXXXX"
                    value={senderNumber}
                    onChange={(event) =>
                      setSenderNumber(event.target.value.replace(/\D/g, '').slice(0, 11))
                    }
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium" htmlFor="trx-id">
                    {t('premium.trx_id')}
                  </label>
                  <Input
                    id="trx-id"
                    type="text"
                    placeholder={t('subscription.trxPlaceholder')}
                    value={trxId}
                    onChange={(event) => setTrxId(event.target.value.toUpperCase())}
                    className="uppercase placeholder:normal-case"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full py-3 text-lg"
                  disabled={submitClaimMutation.isPending || !selectedMethod}
                >
                  {submitClaimMutation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin" /> {t('premium.processing')}
                    </span>
                  ) : (
                    t('premium.verify_payment')
                  )}
                </Button>
                <p className="mt-2 text-center text-xs text-text-secondary">
                  {t('premium.pay_pending')}
                </p>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Checkout;
