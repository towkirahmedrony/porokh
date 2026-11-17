import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, ShieldCheck, Zap, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import PlanCard from '../components/PlanCard';
import { subscriptionService } from '../services/subscriptionService';
import { SubscriptionPlan } from '../types/subscription';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import Button from '@/shared/components/ui/Button';
import { useLanguage } from '@/shared/i18n/LanguageProvider';

const Plans: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();

  const {
    data: plans = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['activePlans'],
    queryFn: subscriptionService.fetchActivePlans,
  });

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    navigate(`/premium/checkout/${plan.id}`, { state: { plan } });
  };

  const perks = [
    {
      icon: <Zap className="text-yellow-500" />,
      title: t('premium.perk_exams_title'),
      desc: t('premium.perk_exams_desc'),
    },
    {
      icon: <TrendingUp className="text-blue-500" />,
      title: t('premium.perk_analytics_title'),
      desc: t('premium.perk_analytics_desc'),
    },
    {
      icon: <ShieldCheck className="text-green-500" />,
      title: t('premium.perk_ads_title'),
      desc: t('premium.perk_ads_desc'),
    },
  ];

  return (
    <div className="min-h-screen bg-app pb-20 text-text-primary">
      <div className="relative overflow-hidden rounded-b-[3rem] bg-primary px-4 pb-24 pt-12 text-primary-foreground">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/0 to-black/20" />
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 flex justify-center"
          >
            <div className="rounded-full bg-surface-elevated p-3 backdrop-blur-md">
              <Crown size={40} className="fill-yellow-500 text-yellow-500" />
            </div>
          </motion.div>
          <h1 className="mb-4 text-3xl font-extrabold md:text-5xl">{t('premium.upgrade_title')}</h1>
          <p className="mx-auto max-w-2xl text-lg opacity-90 md:text-xl">
            {t('premium.plans_subtitle')}
          </p>
        </div>
      </div>

      <div className="relative z-20 mx-auto -mt-16 max-w-6xl px-4">
        <div className="mb-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          {perks.map((perk) => (
            <div
              key={perk.title}
              className="flex items-center gap-4 rounded-xl border border-card-border bg-card-bg p-4 shadow-sm"
            >
              <div className="rounded-lg bg-surface p-2">{perk.icon}</div>
              <div>
                <h4 className="font-bold">{perk.title}</h4>
                <p className="text-xs text-text-secondary">{perk.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {isError ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
            <AlertCircle className="mx-auto mb-2 text-red-500" />
            <p className="text-sm text-red-600 dark:text-red-400">
              {(error as any)?.response?.data?.message || t('premium.network_error')}
            </p>
            <Button
              variant="outline"
              className="mt-4 gap-2"
              onClick={() => refetch()}
              isLoading={isFetching}
            >
              <RefreshCw size={16} /> {t('premium.retry')}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={`skeleton-${i}`}
                  className="h-96 rounded-2xl border border-card-border bg-card-bg p-6"
                >
                  <Skeleton className="mb-4 h-8 w-3/4" />
                  <Skeleton className="mb-8 h-16 w-1/2" />
                  <Skeleton className="mb-2 h-4 w-full" />
                  <Skeleton className="mb-2 h-4 w-full" />
                  <Skeleton className="mb-2 h-4 w-full" />
                </div>
              ))
            ) : plans.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-card-border p-10 text-center text-text-secondary">
                {t('premium.empty_plans')}
              </div>
            ) : (
              plans.map((plan) => <PlanCard key={plan.id} plan={plan} onSelect={handleSelectPlan} />)
            )}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-text-secondary" lang={language}>
          {t('premium.pay_pending')}
        </p>
      </div>
    </div>
  );
};

export default Plans;
