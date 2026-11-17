import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle, Crown, Swords } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/shared/components/ui/Button';
import EmptyState from '@/shared/components/ui/EmptyState';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import ConfirmModal from '@/shared/components/feedback/ConfirmModal';
import LiveQuestionCard from '@/features/exam/components/LiveQuestionCard';
import ExamTimer from '@/features/exam/components/ExamTimer';
import ExamHeader from '@/features/exam/components/ExamHeader';
import type { ExamQuestion } from '@/features/exam/types/exam';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import {
  useBattleDetail,
  useBattleQuestions,
  GROUP_QUERY_KEYS,
} from '../hooks/useGroupQueries';
import { groupsService } from '../services/groupsService';
import { resolveGroupErrorMessage } from '../utils/errorMessages';
import { beginExamActivity } from '@/features/app-update/examActivity';
import {
  deriveBattleState,
  isFinalizable,
  secondsUntil,
  serverOffsetMs,
} from '../utils/battleState';
import type { BattleState, BattleSubmitResult } from '../types';

const formatCountdown = (seconds: number): string => {
  const safe = Math.max(0, seconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

const stateLabelKey = (state: BattleState): 'groups.upcoming' | 'groups.live' | 'groups.grading' | 'groups.completed' | 'groups.cancelled' | 'groups.battle' => {
  switch (state) {
    case 'upcoming':
      return 'groups.upcoming';
    case 'live':
      return 'groups.live';
    case 'grading':
      return 'groups.grading';
    case 'completed':
      return 'groups.completed';
    case 'cancelled':
      return 'groups.cancelled';
    default:
      return 'groups.battle';
  }
};

const GroupBattle: React.FC = () => {
  const { groupId, battleId } = useParams<{ groupId: string; battleId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();

  const detail = useBattleDetail(battleId);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitResult, setSubmitResult] = useState<BattleSubmitResult | null>(null);
  const submittedRef = useRef(false);
  const finalizedRef = useRef(false);

  const battle = detail.data?.battle;
  const participant = detail.data?.myParticipation ?? null;
  const offset = serverOffsetMs(detail.data?.serverNow);
  const state = deriveBattleState(battle, nowMs);

  const joined = Boolean(participant);
  const alreadySubmitted = participant?.status === 'submitted' || Boolean(submitResult);
  // Keep the exam UI open through the two-minute submission grace window so a
  // timer-zero auto-submit can still be delivered, then fall back to standings.
  const withinSubmitGrace = state === 'grading' && !isFinalizable(battle?.end_time, nowMs);
  const canPlay =
    (state === 'live' || withinSubmitGrace) && joined && !alreadySubmitted;

  useEffect(() => {
    setNowMs(Date.now() + offset);
    const timer = window.setInterval(() => {
      setNowMs(Date.now() + offset);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [offset]);

  const questionsQuery = useBattleQuestions(battleId, canPlay);
  const questions = useMemo(
    () => (questionsQuery.data?.questions ?? []) as unknown as ExamQuestion[],
    [questionsQuery.data?.questions]
  );

  const timeLeft = secondsUntil(battle?.end_time, nowMs);
  const startsIn = secondsUntil(battle?.start_time, nowMs);

  const invalidateBattle = () => {
    void queryClient.invalidateQueries({ queryKey: GROUP_QUERY_KEYS.battle(battleId ?? '') });
    void queryClient.invalidateQueries({ queryKey: GROUP_QUERY_KEYS.battles(groupId ?? '') });
  };

  const joinMutation = useMutation({
    mutationFn: () => groupsService.joinBattle(battleId as string),
    onSuccess: () => {
      invalidateBattle();
      toast.success(t('groups.joinSuccess'));
    },
    onError: (error) => toast.error(resolveGroupErrorMessage(error, language)),
  });

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!battleId) throw new Error('Missing battle id');
      submittedRef.current = true;
      return groupsService.submitBattle(battleId, answers);
    },
    onSuccess: (result) => {
      setSubmitResult(result);
      setConfirmOpen(false);
      invalidateBattle();
      toast.success(t('groups.result'));
    },
    onError: (error) => {
      submittedRef.current = false;
      setConfirmOpen(false);
      toast.error(resolveGroupErrorMessage(error, language));
    },
  });

  /**
   * A battle holds its answers in component state until submission, so an OTA
   * reload during play would lose them. Registering activity keeps the update
   * gate closed for exactly as long as the battle can be played and submitted.
   */
  useEffect(() => {
    if (!battleId || !canPlay) return undefined;
    return beginExamActivity(
      `battle:${battleId}`,
      submitMutation.isPending ? 'submission_pending' : 'battle_active'
    );
  }, [battleId, canPlay, submitMutation.isPending]);

  const finalizeMutation = useMutation({
    mutationFn: () => groupsService.finalizeBattle(battleId as string),
    onSuccess: () => {
      invalidateBattle();
    },
    onError: () => {
      // Another member may still be submitting inside the 2-minute grace
      // window. The next poll retries harmlessly.
      finalizedRef.current = false;
    },
  });

  useEffect(() => {
    if (!battle || state !== 'grading') return;
    if (!isFinalizable(battle.end_time, nowMs)) return;
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    finalizeMutation.mutate();
  }, [battle, state, nowMs, finalizeMutation]);

  useEffect(() => {
    if (timeLeft > 0) return;
    if (!canPlay || questions.length === 0) return;
    if (submittedRef.current) return;

    toast(t('groups.timeUp'));

    if (answers && Object.keys(answers).length === 0) {
      // Submitting an empty sheet is still required so the participant is
      // ranked instead of staying "joined" forever.
      submittedRef.current = true;
      submitMutation.mutate();
      return;
    }

    submittedRef.current = true;
    submitMutation.mutate();
  }, [state, timeLeft, canPlay, questions.length, answers, submitMutation, t]);

  const handleOptionSelect = (questionId: string, optionId: string) => {
    if (alreadySubmitted || submittedRef.current) return;
    setAnswers((prev) => ({ ...prev, [questionId]: String(optionId) }));
  };

  if (detail.isLoading || (!detail.data && !detail.isError)) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (!battle) {
    return (
      <div className="space-y-4 py-12 text-center">
        <EmptyState message={resolveGroupErrorMessage(detail.error, language)} />
        <Button variant="secondary" onClick={() => navigate(`/groups/${groupId}`)}>
          {t('groups.backToGroup')}
        </Button>
      </div>
    );
  }

  const standings = detail.data?.standings ?? [];
  const winner = detail.data?.winner ?? null;
  const myResult = submitResult ?? (alreadySubmitted ? participant : null);

  // ---------- live exam mode ----------
  if (canPlay) {
    if (questionsQuery.isLoading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      );
    }

    if (questionsQuery.isError || questions.length === 0) {
      return (
        <div className="space-y-4 py-12 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-text-secondary" />
          <p className="text-sm text-text-secondary">
            {resolveGroupErrorMessage(questionsQuery.error, language)}
          </p>
          <Button variant="secondary" onClick={() => navigate(`/groups/${groupId}`)}>
            {t('groups.backToGroup')}
          </Button>
        </div>
      );
    }

    const answeredCount = Object.keys(answers).length;

    return (
      <div className="min-h-screen pb-32">
        <ExamHeader
          title={battle.title}
          icon={Swords}
          onBack={() => navigate(`/groups/${groupId}`)}
          rightContent={<ExamTimer seconds={timeLeft} layout="compact" />}
        />

        <div className="mx-auto max-w-4xl space-y-4 py-4">
          <div className="rounded-xl border border-card-border bg-card-bg p-3 text-sm text-text-secondary">
            {t('exam.answered')}: {localizeDigits(answeredCount, language)} /{' '}
            {localizeDigits(questions.length, language)}
          </div>

          {questions.map((question, index) => (
            <LiveQuestionCard
              key={question.id}
              question={question}
              index={index}
              selectedOptionId={answers[question.id]}
              onSelectOption={handleOptionSelect}
              onReport={() => undefined}
            />
          ))}
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border-color bg-surface-elevated p-4 backdrop-blur-xl">
          <Button
            className="w-full"
            onClick={() => setConfirmOpen(true)}
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending ? t('common.pleaseWait') : t('groups.submitExam')}
          </Button>
        </div>

        <ConfirmModal
          isOpen={confirmOpen}
          title={t('groups.submitExam')}
          message={t('groups.submitConfirm', { count: answeredCount })}
          onConfirm={() => submitMutation.mutate()}
          onCancel={() => setConfirmOpen(false)}
          isLoading={submitMutation.isPending}
        />
      </div>
    );
  }

  // ---------- result / lobby / standings ----------
  const winnerName = winner?.full_name || winner?.username || '';
  const showWinner = state === 'completed' && winner;

  return (
    <div className="space-y-4 pb-24">
      <button
        type="button"
        onClick={() => navigate(`/groups/${groupId}`)}
        className="text-sm text-text-secondary"
      >
        ← {t('groups.backToGroup')}
      </button>

      <header className="rounded-2xl border border-card-border bg-card-bg p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="inline-flex items-center gap-2 text-xl font-bold text-text-primary">
              <Swords className="h-5 w-5 text-primary" /> {battle.title}
            </h1>
            <p className="mt-1 text-xs text-text-secondary">
              {t(stateLabelKey(state))} · {localizeDigits(battle.participant_count, language)}{' '}
              {t('groups.participants')}
            </p>
          </div>
          {state === 'upcoming' && (
            <span className="rounded-lg bg-secondary px-3 py-1 text-sm font-bold text-primary">
              {formatCountdown(startsIn)}
            </span>
          )}
          {state === 'live' && (
            <ExamTimer seconds={timeLeft} layout="compact" />
          )}
        </div>

        {showWinner && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-primary/10 p-3">
            <Crown className="h-5 w-5 text-primary" />
            <p className="text-sm font-semibold text-primary">
              {t('groups.winner')}: {winnerName}
            </p>
          </div>
        )}
      </header>

      {state === 'cancelled' && <EmptyState message={t('groups.cancelled')} />}

      {state === 'upcoming' && (
        <section className="space-y-3 rounded-2xl border border-card-border bg-card-bg p-4">
          <p className="text-sm text-text-secondary">
            {t('groups.startsIn')}: {formatCountdown(startsIn)}
          </p>
          {!joined ? (
            <Button
              className="w-full"
              isLoading={joinMutation.isPending}
              onClick={() => joinMutation.mutate()}
            >
              {t('groups.joinBattle')}
            </Button>
          ) : (
            <p className="rounded-xl bg-secondary px-3 py-2 text-center text-sm text-text-secondary">
              {t('groups.participants')}: {localizeDigits(battle.participant_count, language)}
            </p>
          )}
        </section>
      )}

      {state === 'live' && !joined && (
        <Button
          className="w-full"
          isLoading={joinMutation.isPending}
          onClick={() => joinMutation.mutate()}
        >
          {t('groups.joinBattle')}
        </Button>
      )}

      {myResult && (
        <section className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-text-primary">{t('groups.result')}</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-text-secondary">{t('groups.score')}</p>
              <p className="font-bold text-primary">
                {localizeDigits(myResult.score ?? 0, language)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">{t('groups.correct')}</p>
              <p className="font-bold text-text-primary">
                {localizeDigits(myResult.correct_count ?? 0, language)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">{t('groups.wrong')}</p>
              <p className="font-bold text-text-primary">
                {localizeDigits(myResult.wrong_count ?? 0, language)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">{t('groups.xpEarned')}</p>
              <p className="font-bold text-text-primary">
                {localizeDigits(participant?.xp_awarded ?? 0, language)}
              </p>
            </div>
          </div>
        </section>
      )}

      {(state === 'grading' || state === 'completed') && (
        <section className="space-y-2">
          <h2 className="text-base font-bold text-text-primary">{t('groups.standings')}</h2>
          {state === 'grading' && standings.length === 0 && (
            <EmptyState message={t('groups.awaitingResults')} />
          )}
          {standings.map((row, index) => {
            const name = row.profile?.full_name || row.profile?.username || 'Student';
            const isWinner = Boolean(battle.winner_id) && row.user_id === battle.winner_id;
            const isMe = row.user_id === user?.id;

            return (
              <div
                key={row.id}
                className={`flex items-center gap-3 rounded-xl border p-3 ${
                  isMe ? 'border-primary bg-primary/5' : 'border-card-border bg-card-bg'
                }`}
              >
                <span className="w-7 text-center text-sm font-bold text-text-secondary">
                  {localizeDigits(row.rank ?? index + 1, language)}
                </span>
                {row.profile?.avatar_url ? (
                  <img
                    src={row.profile.avatar_url}
                    alt={name}
                    className="h-9 w-9 rounded-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text-primary">
                    {name} {isWinner ? '🏆' : ''}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {t('groups.correct')}: {localizeDigits(row.correct_count ?? 0, language)} ·{' '}
                    {t('groups.timeTaken')}:{' '}
                    {formatCountdown(row.time_taken ?? 0)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-primary">
                    {localizeDigits(row.score ?? 0, language)}
                  </p>
                  {row.xp_awarded > 0 && (
                    <p className="text-[10px] text-text-secondary">
                      +{localizeDigits(row.xp_awarded, language)} XP
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {!joined && state === 'grading' && (
        <p className="text-center text-sm text-text-secondary">
          {t('groups.awaitingResults')}
        </p>
      )}

      {state === 'unknown' && <EmptyState message={t('common.noData')} />}
    </div>
  );
};

export default GroupBattle;
