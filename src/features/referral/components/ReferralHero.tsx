import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { Copy, Share2, Check, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { localizeDigits } from '@/shared/i18n/messages';

interface ReferralHeroProps {
  code: string;
  isLoading?: boolean;
  refereeBonus?: number;
}

export const ReferralHero: React.FC<ReferralHeroProps> = ({ code, isLoading, refereeBonus = 100 }) => {
  const { language, t } = useLanguage();
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (copiedCode) timeoutId = setTimeout(() => setCopiedCode(false), 2000);
    return () => clearTimeout(timeoutId);
  }, [copiedCode]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (copiedLink) timeoutId = setTimeout(() => setCopiedLink(false), 2000);
    return () => clearTimeout(timeoutId);
  }, [copiedLink]);

  const handleCopyCode = useCallback(async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
    } catch {}
  }, [code]);

  const handleCopyLink = useCallback(async () => {
    if (!code) return;
    try {
      const referralLink = `${window.location.origin}/register?ref=${code}`;
      await navigator.clipboard.writeText(referralLink);
      setCopiedLink(true);
    } catch {}
  }, [code]);

  const handleShare = useCallback(async () => {
    if (navigator.share && code) {
      try {
        const referralLink = `${window.location.origin}/register?ref=${code}`;
        await navigator.share({
          title: t('referral.shareTitle'),
          text: t('referral.shareText', { bonus: localizeDigits(refereeBonus, language) }),
          url: referralLink,
        });
      } catch (err) {}
    }
  }, [code, refereeBonus, language, t]);

  if (isLoading) {
    return <div className="h-32 rounded-xl animate-pulse bg-secondary" />;
  }

  return (
    <div className="rounded-xl p-4 md:p-5 bg-card-bg border border-card-border shadow-sm">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        
        <div className="flex-1">
          <h2 className="text-lg font-bold mb-1 text-text-primary">{t('referral.inviteLinkTitle')}</h2>
          <p className="text-xs text-text-secondary leading-relaxed max-w-sm">
            {t('referral.inviteLinkDesc')}
          </p>
        </div>

        <div className="w-full md:w-auto flex flex-col gap-2 p-2 rounded-lg border border-border-color bg-secondary">
          <div className="px-3 py-1 font-mono font-bold text-center text-lg tracking-wider text-primary">
            {code || '------'}
          </div>
          <div className="flex gap-1">
            <Button 
              onClick={handleCopyCode}
              disabled={!code}
              size="sm"
              variant="outline"
              className="flex-1 px-2 h-8 flex items-center justify-center gap-1.5 text-primary hover:bg-surface border-border-color text-xs rounded-md focus:ring-focus-ring"
            >
              {copiedCode ? <Check size={14} /> : <Copy size={14} />}
              <span className="hidden sm:inline">{copiedCode ? t('referral.copied') : t('referral.code')}</span>
            </Button>

            <Button 
              onClick={handleCopyLink}
              disabled={!code}
              size="sm"
              className="flex-1 px-2 h-8 flex items-center justify-center gap-1.5 bg-primary text-primary-foreground hover:opacity-90 font-medium text-xs rounded-md focus:ring-focus-ring"
            >
              {copiedLink ? <Check size={14} /> : <LinkIcon size={14} />}
              <span className="hidden sm:inline">{copiedLink ? t('referral.copied') : t('referral.link')}</span>
            </Button>
            
            {!!navigator.share && (
              <Button 
                variant="outline"
                size="sm"
                onClick={handleShare} 
                disabled={!code}
                className="px-2 h-8 text-primary hover:bg-surface border-border-color rounded-md focus:ring-focus-ring"
              >
                <Share2 size={14} />
              </Button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
