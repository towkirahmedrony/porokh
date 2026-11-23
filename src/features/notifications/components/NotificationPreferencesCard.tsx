import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { SettingsSwitch } from '@/features/profile/components/SettingsSwitch';
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '../services/notificationService';

const TYPE_KEYS = [
  ['exam', 'notification.typeExam'],
  ['reward', 'notification.typeReward'],
  ['streak', 'notification.typeStreak'],
  ['social', 'notification.typeSocial'],
  ['billing', 'notification.typeBilling'],
  ['security', 'notification.typeSecurity'],
] as const;

// Security is the only category the product never lets a user silence.
const LOCKED_TYPES = new Set(['security']);

const Toggle: React.FC<{
  checked: boolean;
  disabled?: boolean;
  label: string;
  hint?: string;
  onChange?: () => void;
}> = ({ checked, disabled = false, label, hint, onChange }) => (
  <div
    className={`flex min-h-[56px] items-center justify-between gap-4 py-2 ${
      disabled ? 'opacity-70' : ''
    }`}
  >
    <span className="min-w-0 flex-1">
      <span className="block text-[15px] leading-6 font-medium text-text-primary break-words">{label}</span>
      {hint && <span className="mt-0.5 block text-[13px] leading-5 text-text-secondary break-words">{hint}</span>}
    </span>
    <SettingsSwitch checked={checked} disabled={disabled} label={label} onChange={onChange} />
  </div>
);

const NotificationPreferencesCard: React.FC<{ userId: string }> = ({ userId }) => {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const queryKey = ['notifications', 'preferences', userId];

  const { data, isLoading } = useQuery<NotificationPreferences>({
    queryKey,
    queryFn: fetchNotificationPreferences,
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<NotificationPreferences>(queryKey);
      if (previous) {
        queryClient.setQueryData<NotificationPreferences>(queryKey, {
          ...previous,
          ...patch,
          types: { ...previous.types, ...(patch.types ?? {}) },
        });
      }
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    },
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-2 py-2">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-12 animate-pulse rounded-lg bg-surface-elevated" />
        ))}
      </div>
    );
  }

  return (
    <div className="divide-y divide-border-color/60">
      <Toggle
        checked={data.push}
        label={t('notification.push')}
        onChange={() => mutation.mutate({ push: !data.push })}
      />

      <p className="py-3 text-[13px] leading-5 text-text-secondary">
        {t('notification.inAppAlways')}
      </p>

      <div className="space-y-2 py-4">
        <div>
          <p className="text-[15px] font-medium text-text-primary">
            {t('notification.quietHours')}
          </p>
          <p className="mt-0.5 text-[13px] leading-5 text-text-secondary">
            {t('notification.quietHoursHint')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex flex-1 items-center gap-2 text-[13px] text-text-secondary">
            <span>{t('notification.quietStart')}</span>
            <input
              type="time"
              value={data.quiet_start}
              onChange={(event) =>
                mutation.mutate({ quiet_start: event.target.value })
              }
              className="min-h-[40px] w-full rounded-lg border border-input-border bg-input-bg px-2 text-sm text-text-primary"
            />
          </label>
          <label className="flex flex-1 items-center gap-2 text-[13px] text-text-secondary">
            <span>{t('notification.quietEnd')}</span>
            <input
              type="time"
              value={data.quiet_end}
              onChange={(event) => mutation.mutate({ quiet_end: event.target.value })}
              className="min-h-[40px] w-full rounded-lg border border-input-border bg-input-bg px-2 text-sm text-text-primary"
            />
          </label>
        </div>
      </div>

      <div className="pt-1">
        {TYPE_KEYS.map(([type, labelKey]) => {
          const locked = LOCKED_TYPES.has(type);
          return (
            <Toggle
              key={type}
              checked={locked ? true : data.types[type] !== false}
              disabled={locked}
              label={t(labelKey)}
              hint={locked ? t('notification.alwaysOn') : undefined}
              onChange={
                locked
                  ? undefined
                  : () =>
                      mutation.mutate({
                        types: { ...data.types, [type]: data.types[type] === false },
                      })
              }
            />
          );
        })}
      </div>
    </div>
  );
};

export default NotificationPreferencesCard;
