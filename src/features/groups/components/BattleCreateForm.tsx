import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { contentService } from '@/features/exam/services/contentService';
import { GROUP_QUERY_KEYS } from '../hooks/useGroupQueries';
import { groupsService } from '../services/groupsService';
import { resolveGroupErrorMessage } from '../utils/errorMessages';

type BattleCreateFormProps = {
  groupId: string;
  onCreated?: () => void;
};

export const BattleCreateForm: React.FC<BattleCreateFormProps> = ({ groupId, onCreated }) => {
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [startTime, setStartTime] = useState('');

  const { data: subjects = [] } = useQuery({
    queryKey: ['groups', 'subjects'],
    queryFn: () => contentService.getSubjects(),
    staleTime: 1000 * 60 * 60,
  });

  const { data: chapters = [] } = useQuery({
    queryKey: ['groups', 'chapters', subjectId],
    queryFn: () => contentService.getChapters(subjectId),
    enabled: Boolean(subjectId),
    staleTime: 1000 * 60 * 30,
  });

  const subjectOptions = useMemo(
    () => (subjects as Array<{ id: string; name?: string | null }>) ?? [],
    [subjects]
  );

  const createMutation = useMutation({
    mutationFn: () =>
      groupsService.createBattle(groupId, {
        title: title.trim(),
        subjectId: subjectId || null,
        chapterId: chapterId || null,
        questionCount: Math.min(50, Math.max(5, questionCount)),
        durationMinutes: Math.min(180, Math.max(1, durationMinutes)),
        startTime: startTime ? new Date(startTime).toISOString() : null,
      }),
    onSuccess: () => {
      toast.success(t('groups.battleCreated'));
      setTitle('');
      void queryClient.invalidateQueries({ queryKey: GROUP_QUERY_KEYS.battles(groupId) });
      onCreated?.();
    },
    onError: (error) => toast.error(resolveGroupErrorMessage(error, language)),
  });

  return (
    <form
      className="space-y-3 rounded-2xl border border-card-border bg-card-bg p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (title.trim().length < 2) {
          toast.error(resolveGroupErrorMessage(null, language));
          return;
        }
        createMutation.mutate();
      }}
    >
      <h3 className="text-base font-bold text-text-primary">{t('groups.createBattle')}</h3>

      <label className="block text-sm text-text-secondary">
        {t('groups.battleTitle')}
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value.slice(0, 100))}
          className="mt-1"
          required
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm text-text-secondary">
          {t('groups.subject')}
          <select
            value={subjectId}
            onChange={(event) => {
              setSubjectId(event.target.value);
              setChapterId('');
            }}
            className="mt-1 w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-text-primary"
          >
            <option value="">{t('common.all')}</option>
            {subjectOptions.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name ?? subject.id}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm text-text-secondary">
          {t('groups.chapter')}
          <select
            value={chapterId}
            onChange={(event) => setChapterId(event.target.value)}
            disabled={!subjectId}
            className="mt-1 w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-text-primary disabled:opacity-50"
          >
            <option value="">{t('common.all')}</option>
            {(chapters as Array<{ id: string; name?: string | null }>).map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                {chapter.name ?? chapter.id}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm text-text-secondary">
          {t('groups.questionCount')}
          <Input
            type="number"
            min={5}
            max={50}
            value={questionCount}
            onChange={(event) => setQuestionCount(Number(event.target.value))}
            className="mt-1"
          />
        </label>

        <label className="block text-sm text-text-secondary">
          {t('groups.duration')}
          <Input
            type="number"
            min={1}
            max={180}
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(Number(event.target.value))}
            className="mt-1"
          />
        </label>
      </div>

      <label className="block text-sm text-text-secondary">
        {t('groups.startTime')}
        <Input
          type="datetime-local"
          value={startTime}
          onChange={(event) => setStartTime(event.target.value)}
          className="mt-1"
        />
        <span className="mt-1 block text-xs text-text-secondary">{t('groups.startNow')}</span>
      </label>

      <Button type="submit" isLoading={createMutation.isPending} className="w-full">
        {t('groups.create')}
      </Button>
    </form>
  );
};

export default BattleCreateForm;
