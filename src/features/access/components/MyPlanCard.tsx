import { Crown, Infinity as InfinityIcon, Loader2, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { LOCALE_BY_LANGUAGE, localizeDigits } from '@/shared/i18n/messages';
import { Card } from '@/shared/components/ui/Card';
import { Badge } from '@/shared/components/ui/Badge';
import { useAccess } from '../hooks/useAccess';

const SOURCE_KEYS = {
  subscription: 'premium.source_subscription',
  grant_user: 'premium.source_grant_user',
  grant_all: 'premium.source_grant_all',
  free: 'premium.source_free',
} as const;

export const MyPlanCard = () => {
  const { t, language } = useLanguage();
  const { access, features, isLoading, isError, isAuthenticated, refresh } = useAccess();

  if (!isAuthenticated) return null;

  if (isLoading) {
    return (
      <Card className="space-y-3">
        <div className="flex items-center gap-2 text-text-secondary">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">{t('premium.loading')}</span>
        </div>
      </Card>
    );
  }

  if (isError || !access) {
    return (
      <Card className="space-y-2">
        <p className="text-sm text-text-secondary">{t('premium.network_error')}</p>
        <button
          type="button"
          onClick={refresh}
          className="text-sm font-semibold text-primary hover:underline"
        >
          {t('premium.retry')}
        </button>
      </Card>
    );
  }

  const sourceKey = SOURCE_KEYS[access.source as keyof typeof SOURCE_KEYS];
  const sourceLabel = sourceKey ? t(sourceKey) : access.source;
  const expiresAt = access.premium_expires_at
    ? new Date(access.premium_expires_at).toLocaleDateString(LOCALE_BY_LANGUAGE[language], {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-primary" />
          <h2 className="text-base font-bold text-text-primary">{t('premium.my_plan')}</h2>
        </div>
        {access.premium ? (
          <Badge className="inline-flex items-center gap-1">
            <Crown size={12} className="fill-current" />
            {t('premium.premium_badge')}
          </Badge>
        ) : (
          <Badge className="bg-surface text-text-secondary">{t('premium.free_plan')}</Badge>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase text-text-secondary">{t('premium.tier')}</dt>
          <dd className="mt-0.5 font-semibold capitalize text-text-primary">
            {access.premium ? access.tier : t('premium.free_plan')}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-text-secondary">{t('premium.my_plan')}</dt>
          <dd className="mt-0.5 font-semibold text-text-primary">{sourceLabel}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs uppercase text-text-secondary">{t('premium.expiry')}</dt>
          <dd className="mt-0.5 font-semibold text-text-primary">
            {expiresAt
              ? t('premium.expires_on', { date: expiresAt })
              : t('premium.no_expiry')}
          </dd>
        </div>
      </dl>

      <div className="space-y-3 border-t border-card-border pt-3">
        <p className="text-xs font-semibold uppercase text-text-secondary">
          {t('premium.today_usage')}
        </p>

        {features.length === 0 ? (
          <p className="text-sm text-text-secondary">{t('premium.unlimited')}</p>
        ) : (
          features.map((feature) => {
            const title =
              language === 'en'
                ? feature.title_en || feature.title_bn || feature.feature
                : feature.title_bn || feature.title_en || feature.feature;

            const ratio = feature.unlimited
              ? 100
              : feature.limit > 0
                ? Math.min(100, Math.round((feature.used / feature.limit) * 100))
                : 100;

            return (
              <div key={feature.feature} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-text-primary">{title}</span>
                  <span className="text-text-secondary">
                    {feature.unlimited ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-primary">
                        <InfinityIcon size={14} />
                        {t('premium.unlimited')}
                      </span>
                    ) : (
                      `${localizeDigits(feature.used, language)} / ${localizeDigits(
                        feature.limit,
                        language
                      )}`
                    )}
                  </span>
                </div>
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-surface"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={feature.unlimited ? undefined : feature.limit}
                  aria-valuenow={feature.unlimited ? undefined : feature.used}
                  aria-label={title}
                >
                  <div
                    className={`h-full rounded-full ${
                      !feature.unlimited && feature.used >= feature.limit
                        ? 'bg-red-500'
                        : 'bg-primary'
                    }`}
                    style={{ width: `${ratio}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
};

export default MyPlanCard;
