import React, { useState, useCallback, useEffect } from 'react';
import { ArrowLeft, Save, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { UserProfileData } from '../types/profile';
import { EDUCATION_BOARDS, CLASS_LEVELS, ACADEMIC_GROUPS } from '../utils/profileConstants';
import apiClient from '../../../shared/lib/apiClient';
import { supabase } from '../../../shared/lib/supabase';
import { QUERY_KEYS } from '../../../shared/constants/storageKeys';
import { useAuth } from '../../auth/hooks/useAuth';

// Components
import FormInputGroup from '../components/FormInputGroup';
import FormSelectGroup from '../components/FormSelectGroup';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { MessageError } from '@/shared/i18n/localize';
import ProfileAvatarEdit from '../components/ProfileAvatarEdit';
import { localizeAcademicGroup, localizeClassLevel, localizeEducationBoard } from '../utils/profileLabels';

const EditProfile: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user: authUser, updateUserProfile } = useAuth();
  const { language, t } = useLanguage();

  const [formData, setFormData] = useState<Partial<UserProfileData>>({});

  // Fetch Latest Profile Data strictly from DB to pre-populate fields
  const { data: dbUser, isLoading: isFetchingDB } = useQuery({
    queryKey: ['CURRENT_USER_PROFILE_EDIT'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (error) throw error;
      return data as UserProfileData;
    },
    staleTime: 0, 
  });

  useEffect(() => {
    if (dbUser && !formData.id) {
      setFormData(dbUser);
    } else if (location.state?.user && !formData.id && !dbUser) {
      setFormData(location.state.user);
    }
  }, [dbUser, location.state, formData.id]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: name === 'username' ? value.toLowerCase() : value }));
    if (updateProfileMutation.isError) updateProfileMutation.reset();
  }, []);

  const handleAddressChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({
      ...prev,
      address: {
        ...(typeof prev.address === 'object' && prev.address !== null ? prev.address : {}),
        full_address: value
      }
    }));
    if (updateProfileMutation.isError) updateProfileMutation.reset();
  }, []);

  const handleAvatarUpdate = useCallback((newAvatarUrl: string) => {
    setFormData(prev => ({ ...prev, avatar_url: newAvatarUrl }));
    queryClient.invalidateQueries({ queryKey: Array.isArray(QUERY_KEYS.USER_PROFILE) ? QUERY_KEYS.USER_PROFILE : [QUERY_KEYS.USER_PROFILE] });
  }, [queryClient]);

  const updateProfileMutation = useMutation({
    mutationFn: async (updateData: Partial<UserProfileData>) => {
      try {
        const response = await apiClient.patch('/profiles/update', updateData);
        return response.data;
      } catch (error) {
        if (isAxiosError(error)) {
          throw error.response?.data?.message
            ? new Error(error.response.data.message)
            : new MessageError('profile.updateError');
        }
        throw new MessageError('profile.unexpectedError');
      }
    },
    onSuccess: () => {
      if (authUser) {
        updateUserProfile(authUser.id, {
          full_name: formData.full_name ?? null,
          username: formData.username ?? null,
        });
      }
      const queryKey = Array.isArray(QUERY_KEYS.USER_PROFILE) ? QUERY_KEYS.USER_PROFILE : [QUERY_KEYS.USER_PROFILE];
      queryClient.invalidateQueries({ queryKey });
      navigate(-1);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatePayload = {
      ...(formData.username?.trim() ? { username: formData.username.trim().toLowerCase() } : {}),
      full_name: formData.full_name,
      bio: formData.bio,
      institution: formData.institution,
      class_level: formData.class_level,
      group: formData.group,
      education_board: formData.education_board,
      batch_year: formData.batch_year,
      study_goal: formData.study_goal,
      gender: formData.gender,
      date_of_birth: formData.date_of_birth,
      guardian_phone: formData.guardian_phone,
      address: formData.address,
    };
    updateProfileMutation.mutate(updatePayload);
  };

  const getAddressValue = (address: unknown): string => {
    if (typeof address === 'string') return address;
    if (typeof address === 'object' && address !== null && 'full_address' in address) {
      return String((address as Record<string, unknown>).full_address || '');
    }
    return '';
  };

  const isLoading = updateProfileMutation.isPending;
  const isPageLoading = isFetchingDB && !formData.id;
  const mutationError = updateProfileMutation.error;
  const errorMsg =
    mutationError instanceof MessageError
      ? t(mutationError.key)
      : mutationError?.message;

  if (isPageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative w-full sm:max-w-md sm:mx-auto bg-app">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center px-4 py-4 backdrop-blur-md bg-surface/90 border-b border-border-color">
        <button 
          onClick={() => navigate(-1)} 
          disabled={isLoading}
          className="p-2 -ml-2 rounded-full hover:bg-surface-elevated text-text-primary disabled:opacity-50 transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
          <h2 className="text-lg font-bold ml-2 text-text-primary">{t('profile.editProfileTitle')}</h2>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 pb-28 space-y-6">
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-start gap-3 text-sm text-red-500 transition-all">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p className="font-medium">{errorMsg}</p>
          </div>
        )}

        {/* Avatar Upload Component */}
        <ProfileAvatarEdit 
          userId={formData.id} 
          currentAvatarUrl={formData.avatar_url} 
          onAvatarUpdate={handleAvatarUpdate} 
        />

        <section>
          <h3 className="text-xs font-bold mb-3 tracking-wider text-primary">{t('profile.sectionPersonal')}</h3>
          <div className="space-y-3">
            <FormInputGroup label={t('profile.fieldUsername')} name="username" value={formData.username || ''} onChange={handleChange} placeholder="towkir_ahmed" disabled={isLoading} />
            <FormInputGroup label={t('profile.fieldFullName')} name="full_name" value={formData.full_name || ''} onChange={handleChange} disabled={isLoading} />
            <FormInputGroup label={t('profile.fieldBio')} name="bio" value={formData.bio || ''} onChange={handleChange} disabled={isLoading} isTextArea={true} placeholder={t('profile.bioPlaceholder')} />
            <div className="grid grid-cols-2 gap-3">
              {/* Updated Gender Select Field */}
              <FormSelectGroup 
                label={t('profile.fieldGender')}
                name="gender" 
                value={formData.gender || ''} 
                onChange={handleChange} 
                options={[
                  { label: t('common.select'), value: '' },
                  { label: t('profile.genderMale'), value: 'Male' },
                  { label: t('profile.genderFemale'), value: 'Female' }
                ]} 
                disabled={isLoading} 
              />
              <FormInputGroup type="date" label={t('profile.fieldDateOfBirth')} name="date_of_birth" value={formData.date_of_birth || ''} onChange={handleChange} disabled={isLoading} />
            </div>
            <FormInputGroup label={t('profile.fieldGuardianPhone')} name="guardian_phone" type="tel" value={formData.guardian_phone || ''} onChange={handleChange} placeholder="01XXXXXXXXX" disabled={isLoading} />
            <FormInputGroup label={t('profile.fieldAddress')} name="address" value={getAddressValue(formData.address)} onChange={handleAddressChange} placeholder={t('profile.addressPlaceholder')} disabled={isLoading} />
          </div>
        </section>

        <section>
          <h3 className="text-xs font-bold mb-3 tracking-wider text-primary">{t('profile.sectionAcademic')}</h3>
          <div className="space-y-3">
            <FormInputGroup label={t('profile.fieldInstitution')} name="institution" value={formData.institution || ''} onChange={handleChange} disabled={isLoading} />
            <div className="grid grid-cols-2 gap-3">
              <FormSelectGroup label={t('profile.fieldClass')} name="class_level" value={formData.class_level || ''} onChange={handleChange}
                options={CLASS_LEVELS.map(c => ({ label: localizeClassLevel(c, language), value: c }))} disabled={isLoading} />
              <FormSelectGroup label={t('profile.fieldGroup')} name="group" value={formData.group || ''} onChange={handleChange}
                options={ACADEMIC_GROUPS.map(g => ({ label: localizeAcademicGroup(g, language), value: g }))} disabled={isLoading} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormSelectGroup label={t('profile.fieldBoard')} name="education_board" value={formData.education_board || ''} onChange={handleChange}
                options={EDUCATION_BOARDS.map(b => ({ label: localizeEducationBoard(b, language), value: b }))} disabled={isLoading} />
              <FormInputGroup label={t('profile.fieldBatch')} name="batch_year" value={formData.batch_year || ''} onChange={handleChange} placeholder={t('profile.batchPlaceholder')} disabled={isLoading} />
            </div>
            <FormInputGroup label={t('profile.fieldStudyGoal')} name="study_goal" value={formData.study_goal || ''} onChange={handleChange} placeholder={t('profile.studyGoalPlaceholder')} disabled={isLoading} />
          </div>
        </section>
      </form>

      {/* Footer Save Button */}
      <div className="fixed bottom-0 left-0 right-0 sm:max-w-md sm:mx-auto p-4 pb-6 z-20 backdrop-blur-md bg-surface/90 border-t border-border-color">
        <button 
          onClick={handleSubmit} 
          disabled={isLoading}
          className="w-full font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 hover:opacity-90 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg bg-primary text-primary-foreground"
        >
          {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
          {isLoading ? t('profile.saving') : t('profile.saveChanges')}
        </button>
      </div>
    </div>
  );
};

export default EditProfile;
