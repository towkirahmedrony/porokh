import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Clock, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '@/shared/lib/apiClient';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import Loader from '@/shared/components/feedback/Loader';
import { sanitizeQuestionHtml } from '@/shared/utils/sanitize';
import {
  ChallengeData,
  ChallengeResult,
  ChallengeSubmitPayload,
} from '../types/content';

const SECONDS_PER_QUESTION = 15;

type SubmitResponse = {
  success?: boolean;
  message?: string;
  data?: ChallengeResult;
};

export const ChallengePlay: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { challengeId } = useParams<{ challengeId: string }>();

  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(SECONDS_PER_QUESTION);
  const [isFinished, setIsFinished] = useState(false);
  const [result, setResult] = useState<ChallengeResult | null>(null);

  // 1. Fetch the challenge. Questions arrive without answer keys: the server
  // grades every submission, so nothing here can be scored locally.
const { data: challenge, isLoading, isError } = useQuery<ChallengeData>({
    queryKey: ['challenge', challengeId],
    queryFn: async () => {
      if (!challengeId) throw new Error('Challenge ID is missing');
      const res = await apiClient.get(`/community/user/challenges/${challengeId}`);
      if (!res.data?.success) {
        throw new Error(res.data?.message || 'Failed to fetch challenge');
      }
      return res.data.data;
    },
    enabled: !!challengeId,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const questions = useMemo(() => challenge?.questions ?? [], [challenge?.questions]);
  const opponentData = useMemo(
    () => challenge?.opponent ?? { name: t('exam.opponent'), score: 0, time_taken: 0 },
    [challenge?.opponent, t]
  );

  // An already-submitted challenge shows the stored authoritative result
  // instead of replaying it.
  useEffect(() => {
    if (challenge?.result) setResult(challenge.result);
  }, [challenge?.result]);

  // 2. Submission sends selected answers only.
  const submitChallengeMutation = useMutation({
    mutationFn: async (payload: ChallengeSubmitPayload): Promise<ChallengeResult> => {
      if (!challengeId) throw new Error('Challenge ID is missing');
      const res = await apiClient.post<SubmitResponse>(
        `/community/user/challenges/${challengeId}/submit`,
        payload
      );

      if (!res.data?.success || !res.data.data) {
        throw new Error(res.data?.message || 'Failed to submit challenge');
      }

      return res.data.data;
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success(t('exam.resultSaved'));
    },
    onError: (mutationError: unknown) => {
      const message =
        typeof mutationError === 'object' &&
        mutationError !== null &&
        'response' in mutationError
          ? (mutationError as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : undefined;

      toast.error(message || t('exam.resultSaveError'));
    },
  });

  const submitAnswers = useCallback(
    (finalAnswers: Record<string, string>) => {
      if (submitChallengeMutation.isPending) return;
      submitChallengeMutation.mutate({ answers: finalAnswers });
    },
    [submitChallengeMutation]
  );

  // 3. Advance: record the selection, never a score.
  const handleNext = useCallback(() => {
    const currentQ = questions[currentQIndex];
    if (!currentQ) return;

    const nextAnswers =
      selectedOption !== null
        ? { ...answers, [currentQ.id]: selectedOption }
        : { ...answers };

    setAnswers(nextAnswers);

    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex((prev) => prev + 1);
      setSelectedOption(null);
      setTimeLeft(SECONDS_PER_QUESTION);
      return;
    }

    setIsFinished(true);
    submitAnswers(nextAnswers);
  }, [answers, currentQIndex, questions, selectedOption, submitAnswers]);

  // 4. Auto-advance when a question's timer expires.
  useEffect(() => {
    if (timeLeft === 0 && !isFinished) handleNext();
  }, [timeLeft, isFinished, handleNext]);

  // 5. Per-question countdown.
  useEffect(() => {
    if (isLoading || isError || isFinished || questions.length === 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isLoading, isError, isFinished, questions.length]);

  if (!challengeId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-center bg-app text-text-primary">
        <div className="p-6 rounded-xl max-w-sm w-full bg-card-bg border border-card-border shadow-sm">
          <p className="font-bold text-lg mb-4 text-accent">{t('exam.challengeIdMissing')}</p>
          <button
            type="button"
            onClick={() => navigate('/dashboard/home')}
            className="px-6 py-2 rounded-lg font-bold w-full bg-secondary text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {t('exam.backHome')}
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app text-text-primary">
        <Loader />
      </div>
    );
  }

  if (isError || questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-center bg-app text-text-primary">
        <div className="p-6 rounded-xl max-w-sm w-full bg-card-bg border border-card-border shadow-sm">
          <p className="font-bold text-lg mb-4 text-accent">
            {t('exam.challengeLoadFailed')}
          </p>
          <button
            type="button"
            onClick={() => navigate('/dashboard/home')}
            className="px-6 py-2 rounded-lg font-bold w-full bg-secondary text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {t('exam.backHome')}
          </button>
        </div>
      </div>
    );
  }

  // 6. Finished: show the server's authoritative result.
  if (isFinished) {
    const score = result?.score ?? 0;
    const total = result?.total ?? questions.length;
    const isSaving = submitChallengeMutation.isPending;

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-app text-text-primary">
        <div className="p-8 rounded-2xl text-center shadow-lg w-full max-w-sm bg-card-bg border border-card-border">
          <h2 className="text-2xl font-bold mb-4">{t('exam.challengeFinished')}</h2>

          {isSaving ? (
            <div className="py-6">
              <Loader />
              <p className="mt-3 text-sm font-bold text-text-secondary">{t('exam.checkingScore')}</p>
            </div>
          ) : result ? (
            <div className="flex justify-between my-6 px-4">
              <div>
                <p className="text-sm font-bold text-text-secondary">{t('exam.yourScore')}</p>
                <p className="text-4xl font-black mt-2 text-primary">
                  {score}/{total}
                </p>
              </div>
              <div>
                <p className="text-sm font-bold text-text-secondary">{opponentData.name}</p>
                <p className="text-4xl font-black mt-2 text-accent">{opponentData.score}</p>
              </div>
            </div>
          ) : (
            <p className="my-6 text-sm font-bold text-accent">
              {t('exam.resultSaveFailed')}
            </p>
          )}

          {!result && !isSaving && (
            <button
              type="button"
              onClick={() => submitAnswers(answers)}
              className="px-6 py-4 rounded-xl font-bold w-full transition-all bg-primary text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {t('exam.submitAgain')}
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate('/dashboard/home', { replace: true })}
            className="px-6 py-3 rounded-xl font-bold w-full mt-3 bg-secondary text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {t('exam.backHome')}
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQIndex];

  return (
    <div className="min-h-screen flex flex-col relative pb-32 bg-app text-text-primary">
      <div className="sticky top-0 z-30 shadow-sm transition-colors duration-300 bg-surface border-b border-border-color">
        <div className="max-w-3xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="font-bold text-primary">
            {t('exam.questionOf', { current: currentQIndex + 1, total: questions.length })}
          </div>
          <div
            className={`flex items-center gap-1 font-mono font-bold text-lg ${
              timeLeft <= 5 ? 'text-accent animate-pulse' : 'text-primary'
            }`}
          >
            <Clock size={20} />
            <span>{String(timeLeft).padStart(2, '0')}s</span>
          </div>
          <div className="font-bold text-accent">{opponentData.name}</div>
        </div>
      </div>

      <div className="flex-1 p-4 w-full max-w-3xl mx-auto mt-4">
        {currentQuestion?.image_url && (
          <img
            src={currentQuestion.image_url}
            alt=""
            className="mb-4 max-h-60 rounded-xl object-contain"
          />
        )}

        <h2
          className="text-xl font-bold mb-8 leading-relaxed text-text-primary"
          dangerouslySetInnerHTML={{
            __html: sanitizeQuestionHtml(currentQuestion?.text ?? ''),
          }}
        />

        <div className="space-y-4">
          {(currentQuestion?.options ?? []).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSelectedOption(opt.id)}
              className={`w-full p-5 rounded-xl text-left font-medium transition-all duration-200 border focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                selectedOption === opt.id
                  ? 'bg-surface-elevated border-border-color ring-2 ring-focus-ring text-text-primary'
                  : 'bg-card-bg border-card-border text-text-primary hover:bg-surface-elevated'
              }`}
            >
              {opt.text}
            </button>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 w-full p-4 z-30 bg-surface border-t border-border-color">
        <div className="max-w-3xl mx-auto flex justify-end">
          <button
            type="button"
            onClick={handleNext}
            disabled={selectedOption === null || submitChallengeMutation.isPending}
            className="px-8 py-4 font-bold rounded-xl flex gap-2 items-center transition-all active:scale-95 bg-primary text-primary-foreground disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {t('exam.next')} <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
