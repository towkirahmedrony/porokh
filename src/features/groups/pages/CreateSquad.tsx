import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import { useGroupsConfig, GROUP_QUERY_KEYS } from '../hooks/useGroupQueries';
import { groupsService } from '../services/groupsService';
import { resolveGroupErrorMessage } from '../utils/errorMessages';
import { isValidGroupSlug, suggestGroupSlug } from '../utils/groupSlug';
import type { GroupVisibility } from '../types';

const ICONS = ['🛡️', '📚', '🔥', '🎯', '🌟', '🦁', '🧠', '💡', '🚀', '⚡'];

const CreateSquad: React.FC = () => {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const { data: config, isLoading } = useGroupsConfig();

  const cap = config?.squadMaxMembers ?? 50;
  const defaultMax = config?.squadDefaultMembers ?? 30;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [icon, setIcon] = useState(ICONS[0]);
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<GroupVisibility>('code');
  const [maxMembers, setMaxMembers] = useState(defaultMax);

  useEffect(() => {
    setMaxMembers((current) => Math.min(cap, Math.max(2, current || defaultMax)));
  }, [cap, defaultMax]);

  const createMutation = useMutation({
    mutationFn: () =>
      groupsService.createGroup({
        name: name.trim(),
        icon,
        description: description.trim() || null,
        groupType: 'squad',
        maxMembers,
        visibility,
        ...(slug.trim() ? { slug: slug.trim().toLowerCase() } : {}),
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: GROUP_QUERY_KEYS.all });
      toast.success(t('groups.createSuccess'));
      navigate(`/groups/${result.group?.slug ?? result.id}?created=1`, { replace: true });
    },
    onError: (error) => toast.error(resolveGroupErrorMessage(error, language)),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-24">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm text-text-secondary"
      >
        <ArrowLeft className="h-4 w-4" /> {t('common.back')}
      </button>

      <h1 className="text-2xl font-bold text-text-primary">{t('groups.createSquad')}</h1>

      <form
        className="space-y-5 rounded-2xl border border-card-border bg-card-bg p-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim().length < 2 || createMutation.isPending) return;
          if (slug.trim() && !isValidGroupSlug(slug)) return;
          createMutation.mutate();
        }}
      >
        <label className="block text-sm font-medium text-text-secondary">
          {t('groups.name')}
          <Input
            value={name}
            onChange={(event) => setName(event.target.value.slice(0, 50))}
            className="mt-1"
            minLength={2}
            maxLength={50}
            required
          />
          <span className="mt-1 block text-right text-xs">{name.length}/50</span>
        </label>

        <label className="block text-sm font-medium text-text-secondary">
          {t('groups.slug')}
          <Input
            value={slug}
            onChange={(event) => setSlug(event.target.value.toLowerCase().slice(0, 40))}
            className="mt-1"
            placeholder={t('groups.slugPlaceholder')}
            maxLength={40}
          />
          <span className="mt-1 block text-xs">{t('groups.slugHint')}</span>
          <span className="mt-1 flex items-center justify-between gap-2 text-xs">
            <span className={slug && !isValidGroupSlug(slug) ? 'text-red-500' : 'text-text-secondary'}>
              {slug && !isValidGroupSlug(slug) ? t('groups.slugInvalid') : t('groups.slugHelp')}
            </span>
            {suggestGroupSlug(name) && (
              <button
                type="button"
                onClick={() => setSlug(suggestGroupSlug(name))}
                className="font-semibold text-primary"
              >
                {t('groups.slugSuggestion')}
              </button>
            )}
          </span>
        </label>

        <div>
          <p className="mb-2 text-sm font-medium text-text-secondary">{t('groups.icon')}</p>
          <div className="flex flex-wrap gap-2">
            {ICONS.map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => setIcon(choice)}
                className={`flex h-11 w-11 items-center justify-center rounded-xl border text-xl ${
                  icon === choice
                    ? 'border-primary bg-primary/10'
                    : 'border-border-color bg-surface'
                }`}
                aria-label={choice}
              >
                {choice}
              </button>
            ))}
          </div>
        </div>

        <label className="block text-sm font-medium text-text-secondary">
          {t('groups.description')}
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value.slice(0, 300))}
            rows={3}
            maxLength={300}
            className="mt-1 w-full resize-none rounded-lg border border-input-border bg-input-bg px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-focus-ring"
          />
          <span className="mt-1 block text-right text-xs">{description.length}/300</span>
        </label>

        <div>
          <p className="mb-2 text-sm font-medium text-text-secondary">{t('groups.visibility')}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(
              [
                ['public', t('groups.visibilityPublic')],
                ['code', t('groups.visibilityCode')],
                ['approval', t('groups.visibilityApproval')],
              ] as Array<[GroupVisibility, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setVisibility(value)}
                className={`rounded-xl border px-3 py-2 text-sm ${
                  visibility === value
                    ? 'border-primary bg-primary/10 font-semibold text-primary'
                    : 'border-border-color text-text-secondary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-text-secondary">{t('groups.maxMembers')}</span>
            <span className="font-bold text-primary">
              {localizeDigits(maxMembers, language)}
            </span>
          </div>
          <input
            type="range"
            min={2}
            max={cap}
            value={maxMembers}
            onChange={(event) => setMaxMembers(Number(event.target.value))}
            className="mt-2 w-full accent-[var(--color-primary,#10b981)]"
          />
        </div>

        <Button type="submit" className="w-full" isLoading={createMutation.isPending}>
          {t('groups.create')}
        </Button>
      </form>
    </div>
  );
};

export default CreateSquad;
