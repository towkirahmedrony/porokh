import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { AlertCircle, Loader2, Save } from 'lucide-react';
import toast from 'react-hot-toast';

import { supabase } from '@/shared/lib/supabase';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import type { AppMessageKey } from '@/shared/i18n/messages';
import { QUERY_KEYS } from '@/shared/constants/storageKeys';
import { BackButton } from '@/shared/components/ui/BackButton';
import AcademicProfileForm from '../components/AcademicProfileForm';
import {
  academicProfileFromRecord,
  buildAcademicProfileRpcParams,
  validateAcademicProfile,
  type AcademicProfileRecord,
  type AcademicProfileValues,
} from '../utils/academicProfile';

/**
 * Completion/editing surface for students whose academic details are missing
 * (every account created before these fields existed). It never blocks the
 * app: the student opens it from their profile or settings.
 */
export default function AcademicProfile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, updateUserProfile } = useAuth();
  const { language, t } = useLanguage();
  const initializedRef = useRef(false);

  const [values, setValues] = useState<AcademicProfileValues | null>(null);
  const [error, setError] = useState<AppMessageKey | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['academic-profile-editor', user?.id ?? null],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error: loadError } = await supabase
        .from('profiles')
        .select('hsc_batch, hsc_group, admission_targets, other_admission_target')
        .eq('id', user.id)
        .single();

      if (loadError) throw loadError;
      return data as AcademicProfileRecord;
    },
    enabled: Boolean(user?.id),
  });

  useEffect(() => {
    if (initializedRef.current || isLoading) return;

    setValues(academicProfileFromRecord(profile ?? user));
    initializedRef.current = true;
  }, [isLoading, profile, user]);

  const saveMutation = useMutation({
    mutationFn: async (nextValues: AcademicProfileValues) => {
      const params = buildAcademicProfileRpcParams(nextValues);
      const { error: rpcError } = await supabase.rpc(
        'update_academic_profile',
        params
      );

      if (rpcError) throw rpcError;
      return params;
    },
    onSuccess: (params) => {
      if (user?.id) {
        updateUserProfile(user.id, {
          hsc_batch: params.p_hsc_batch,
          hsc_group: params.p_hsc_group,
          admission_targets: params.p_admission_targets,
          other_admission_target: params.p_other_admission_target,
        });
      }

      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USER_PROFILE });
      queryClient.invalidateQueries({ queryKey: ['academic-profile-editor'] });
      queryClient.invalidateQueries({ queryKey: ['CURRENT_USER_PROFILE_EDIT'] });
      toast.success(t('academic.saved'));
      navigate(-1);
    },
    onError: (saveError: unknown) => {
      const message =
        saveError instanceof Error ? saveError.message.toLowerCase() : '';

      if (message.includes('not authenticated')) {
        setError('academic.notAuthenticated');
      } else if (message.includes('invalid hsc batch')) {
        setError('academic.batchRequired');
      } else if (message.includes('invalid hsc group')) {
        setError('academic.groupRequired');
      } else if (message.includes('invalid admission target')) {
        setError('academic.targetsRequired');
      } else if (message.includes('invalid other admission target')) {
        setError('academic.otherTooLong');
      } else {
        setError('academic.saveFailed');
      }
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!values) return;

    const validationError = validateAcademicProfile(values);
    if (validationError) {
      setError(validationError);
      return;
    }

    saveMutation.mutate(values);
  };

  const isSaving = saveMutation.isPending;

  if (isLoading || !values) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-screen w-full flex-col bg-app text-text-primary ${
        language === 'bn' ? "font-['Noto_Sans_Bengali']" : 'font-sans'
      }`}
    >
      <header
        className="sticky top-0 z-20 flex items-center gap-2 border-b border-border-color bg-surface/90 px-4 py-3 backdrop-blur-md"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
      >
        <BackButton />
        <div className="min-w-0">
          <h1 className="text-lg font-bold leading-6">
            {t('academic.pageTitle')}
          </h1>
          <p className="truncate text-xs text-text-secondary">
            {t('academic.pageSubtitle')}
          </p>
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        className="mx-auto w-full max-w-md flex-1 space-y-6 px-4 pb-28 pt-5"
        noValidate
      >
        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-500"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="font-medium leading-5">{t(error)}</p>
          </div>
        )}

        <AcademicProfileForm
          idPrefix="academic-profile"
          values={values}
          onChange={(patch) => {
            setValues((prev) => (prev ? { ...prev, ...patch } : prev));
            setError(null);
          }}
          disabled={isSaving}
        />
      </form>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border-color bg-surface/90 p-4 pb-6 backdrop-blur-md sm:mx-auto sm:max-w-md">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-bold text-primary-foreground shadow-lg transition-all hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSaving ? (
            <>
              <Loader2 size={20} className="animate-spin" aria-hidden="true" />
              {t('academic.saving')}
            </>
          ) : (
            <>
              <Save size={20} aria-hidden="true" />
              {t('academic.save')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
