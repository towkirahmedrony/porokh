import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { useBackInterceptor } from '@/app/navigation/useBackInterceptor';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import apiClient from '@/shared/lib/apiClient';
import { X, Swords } from 'lucide-react';
import { useAuth } from '../../auth/hooks/useAuth';
import toast from 'react-hot-toast';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { SubjectSelector } from './SubjectSelector';
import { ChapterSelector } from './ChapterSelector';
import { Subject, Chapter } from '../types/content';

interface ChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  opponentId: string;
  opponentName: string;
  groupId?: string;
}

type AxiosLikeError = {
  response?: { status?: number; data?: { message?: unknown } };
  message?: string;
};

const CHALLENGE_QUESTION_COUNT = 10;

/**
 * Group battle setup.
 *
 * Exam papers and `group_battles` rows are protected tables: the browser cannot
 * write them. Creation therefore goes through the backend endpoint, which
 * validates both participants and authors the paper server-side.
 */
export const ChallengeSetupModal: React.FC<ChallengeModalProps> = ({
  isOpen,
  onClose,
  opponentId,
  opponentName,
  groupId,
}) => {
  const { user } = useAuth();
  // Hooks must run unconditionally, before the `!isOpen` early return below.
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedChapter, setSelectedChapter] = useState<string>('all');

  // Reset chapter selection when subject changes
  useEffect(() => {
    setSelectedChapter('all');
  }, [selectedSubject]);

  // 1. Fetch Subjects using React Query
  const { data: subjects = [], isLoading: isSubjectsLoading } = useQuery({
    queryKey: ['subjects', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('id, name_bn, name_en')
        .eq('is_active', true);

      if (error) throw error;
      return data as Pick<Subject, 'id' | 'name_bn' | 'name_en'>[];
    },
    enabled: isOpen,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // 2. Fetch Chapters using React Query
  const { data: chapters = [], isLoading: isChaptersLoading } = useQuery({
    queryKey: ['chapters', 'active', selectedSubject],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chapters')
        .select('id, name_bn, name_en')
        .eq('subject_id', selectedSubject)
        .eq('is_active', true);

      if (error) throw error;
      return data as Pick<Chapter, 'id' | 'name_bn' | 'name_en'>[];
    },
    enabled: isOpen && !!selectedSubject,
    staleTime: 5 * 60 * 1000,
  });

  // 3. Create the battle through the protected backend endpoint
  const challengeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSubject) {
        throw new Error(t('exam.selectSubjectError'));
      }

      if (!user?.id) {
        throw new Error(t('exam.userMissing'));
      }

      const response = await apiClient.post('/exams/user/group-battle', {
        opponentId,
        group_id: groupId || undefined,
        subject_id: selectedSubject,
        chapter_id: selectedChapter !== 'all' ? selectedChapter : undefined,
        question_count: CHALLENGE_QUESTION_COUNT,
      });

      return response.data?.data ?? null;
    },
    onSuccess: async () => {
      toast.success(t('exam.challengeSuccess'));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['challenge'] }),
        queryClient.invalidateQueries({ queryKey: ['lobby'] }),
      ]);
      onClose();
    },
    onError: (error: AxiosLikeError) => {
      const status = error?.response?.status;
      const serverMessage = error?.response?.data?.message;

      if (status === 401) {
        toast.error(t('exam.sessionExpired'));
        return;
      }

      if (status === 403) {
        toast.error(
          typeof serverMessage === 'string' && serverMessage.trim()
            ? serverMessage
            : t('exam.noChallengePermission')
        );
        return;
      }

      toast.error(
        typeof serverMessage === 'string' && serverMessage.trim()
          ? serverMessage
          : error?.message || t('exam.challengeError')
      );
    },
  });

  const handleChallengeSubmit = useCallback(() => {
    // One creation per click: the backend would create another paper otherwise.
    if (challengeMutation.isPending) return;
    challengeMutation.mutate();
  }, [challengeMutation]);

  // Registered before the early return so hardware Back closes the sheet.
  useBackInterceptor(onClose, isOpen);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center backdrop-blur-sm bg-black/50">
      <div className="w-full sm:w-96 rounded-t-3xl sm:rounded-3xl p-6 transform transition-all animate-slide-up bg-surface-elevated border border-border-color">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2 text-text-primary">
            <Swords className="text-accent" /> {t('exam.challengeSetup')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full transition-colors bg-surface hover:bg-surface-elevated"
            aria-label={t('common.closeAria')}
          >
            <X size={20} className="text-text-secondary" />
          </button>
        </div>

        <p className="text-sm mb-6 text-text-secondary">
          {t('exam.challengeIntro', { name: opponentName })}
        </p>

        <SubjectSelector
          isLoading={isSubjectsLoading}
          subjects={subjects}
          selectedSubject={selectedSubject}
          onSelect={setSelectedSubject}
        />

        <ChapterSelector
          isLoading={isChaptersLoading}
          chapters={chapters}
          selectedChapter={selectedChapter}
          selectedSubject={selectedSubject}
          onSelect={setSelectedChapter}
        />

        <div className="p-4 rounded-xl border mb-6 bg-badge-bg border-border-color">
          <p className="text-sm text-center font-medium text-badge-text">
            🏆 {t('exam.winnerXpNote')}
          </p>
        </div>

        {challengeMutation.isPending ? (
          <Skeleton className="w-full h-[52px] rounded-xl" />
        ) : (
          <button
            onClick={handleChallengeSubmit}
            disabled={challengeMutation.isPending}
            className="w-full py-3.5 font-bold rounded-xl transition-all active:scale-95 flex justify-center items-center gap-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-primary-foreground"
          >
            {t('exam.throwChallenge')}
          </button>
        )}
      </div>
    </div>
  );
};
