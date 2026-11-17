import React, { useMemo } from 'react';
import { Check, Star } from 'lucide-react';
import { Tables } from '@/shared/types/supabase';
import Button from '@/shared/components/ui/Button';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { pickLang } from '@/shared/i18n/localize';
import { localizeDigits } from '@/shared/i18n/messages';

type SubscriptionPlan = Tables<'subscription_plans'>;

interface PlanCardProps {
  plan: SubscriptionPlan;
  onSelect: (plan: SubscriptionPlan) => void;
  isSelected?: boolean;
}

const PlanCard: React.FC<PlanCardProps> = ({ plan, onSelect, isSelected = false }) => {
  const { language, t } = useLanguage();
  const isDiscounted = plan.discounted_price !== null && plan.discounted_price < plan.price;
  const currentPrice = isDiscounted ? plan.discounted_price : plan.price;

  const discountPercent = useMemo(() => {
    if (!isDiscounted || !plan.discounted_price || !plan.price) return 0;
    return Math.round(((plan.price - plan.discounted_price) / plan.price) * 100);
  }, [isDiscounted, plan.price, plan.discounted_price]);

  const featuresList = useMemo(() => {
    const toList = (value: unknown): string[] => {
      if (Array.isArray(value)) return value.map(String);
      if (value && typeof value === 'object') {
        const localized = value as { bn?: unknown; en?: unknown };
        const preferred = language === 'en' ? localized.en : localized.bn;
        const fallback = language === 'en' ? localized.bn : localized.en;
        const list = Array.isArray(preferred) && preferred.length ? preferred : fallback;
        return Array.isArray(list) ? list.map(String) : [];
      }
      return [];
    };
    const selected = language === 'en' && plan.features_en != null ? plan.features_en : plan.features;
    const result = toList(selected);
    return result.length ? result : toList(plan.features);
  }, [language, plan.features, plan.features_en]);

  if (!plan) return null;

  return (
    <div
      className={`relative flex flex-col rounded-2xl border-2 p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl bg-card-bg ${
        isSelected
          ? 'border-primary shadow-lg ring-2 ring-primary/30'
          : isDiscounted
            ? 'border-primary shadow-md'
            : 'border-card-border'
      }`}
    >
      {isDiscounted && discountPercent > 0 && (
        <div className="absolute -top-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-sm">
          <Star size={12} fill="currentColor" />
          {t('premium.save_badge', { percent: localizeDigits(discountPercent, language) })}
        </div>
      )}

      <div className="mb-6 pt-2 text-center">
        <h3 className="mb-2 text-xl font-bold text-text-primary">
          {pickLang(language, plan.name, plan.name_en)}
        </h3>
        <div className="flex items-center justify-center gap-2">
          <span className="text-3xl font-extrabold text-primary">
            ৳{localizeDigits(currentPrice ?? 0, language)}
          </span>
          {isDiscounted && (
            <span className="text-lg text-text-secondary line-through">
              ৳{localizeDigits(plan.price, language)}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-text-secondary">
          {t('premium.days', { days: localizeDigits(plan.duration_days, language) })}
        </p>
      </div>

      <div className="mb-8 flex-1">
        <ul className="space-y-3">
          {featuresList.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-3">
              <div className="mt-1 min-w-[18px]">
                <Check size={18} className="text-primary" />
              </div>
              <span className="text-sm leading-tight text-text-primary">{String(feature)}</span>
            </li>
          ))}
        </ul>
      </div>

      <Button
        onClick={() => onSelect(plan)}
        className="w-full py-3 text-lg font-semibold shadow-lg"
        variant={isSelected || isDiscounted ? 'primary' : 'outline'}
        aria-pressed={isSelected}
      >
        {t('premium.choose_plan')}
      </Button>
    </div>
  );
};

export default React.memo(PlanCard);
