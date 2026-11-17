import React, { useState } from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Tag, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { referralService } from '../services/referralService';
import { useAuth } from '../../auth/hooks/useAuth';

export const RedeemCode: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const redeemMutation = useMutation({
    mutationFn: (referralCode: string) => referralService.redeemCode(user!.id, referralCode),
    onSuccess: () => {
      setFeedback({ type: 'success', message: t('referral.redeemSuccess') });
      setCode('');
      queryClient.invalidateQueries({ queryKey: ['referralStats', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['referralHistory', user?.id] });
    },
    onError: () => {
      setFeedback({ type: 'error', message: t('referral.redeemError') });
    }
  });

  const handleRedeem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !code.trim()) return;
    setFeedback(null);
    redeemMutation.mutate(code.trim());
  };

  return (
    <div className="p-4 rounded-xl bg-[var(--dyn-card)] border border-[color-mix(in_srgb,var(--dyn-text)_10%,transparent)] shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-[color-mix(in_srgb,var(--dyn-text)_5%,transparent)] text-[var(--dyn-text)]">
          <Tag size={16} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[var(--dyn-text)]">{t('referral.redeemTitle')}</h3>
        </div>
      </div>

      <form onSubmit={handleRedeem} className="flex flex-col gap-2">
        <div className="relative flex items-center">
          <Input
            placeholder={t('referral.codePlaceholder')}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setFeedback(null);
            }}
            className="w-full pr-10 text-sm font-mono uppercase bg-[color-mix(in_srgb,var(--dyn-text)_2%,transparent)] py-2"
            disabled={redeemMutation.isPending}
          />
          <Button
            disabled={!code.trim() || redeemMutation.isPending}
            type="submit"
            size="sm"
            className="absolute right-1 h-auto py-1.5 px-2 bg-[var(--dyn-primary)] text-[var(--dyn-bg)] hover:opacity-90 disabled:opacity-50 rounded-md"
          >
            {redeemMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
          </Button>
        </div>

        <div className="min-h-[16px]">
          {feedback && (
            <div className={`flex items-center gap-1.5 text-[11px] font-medium ${feedback.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
              {feedback.type === 'success' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
              <span>{feedback.message}</span>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
