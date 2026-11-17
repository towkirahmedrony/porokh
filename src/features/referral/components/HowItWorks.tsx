import React from 'react';
import { Send, UserPlus, Gift } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';

interface HowItWorksProps {
  referrerBonus: number;
  refereeBonus: number;
}

export const HowItWorks: React.FC<HowItWorksProps> = ({ referrerBonus, refereeBonus }) => {
  const { language, t } = useLanguage();
  const steps = [
    {
      icon: <Send className="w-5 h-5" />,
      title: t('referral.step1Title'),
      description: t('referral.step1Desc'),
    },
    {
      icon: <UserPlus className="w-5 h-5" />,
      title: t('referral.step2Title'),
      description: t('referral.step2Desc'),
    },
    {
      icon: <Gift className="w-5 h-5" />,
      title: t('referral.step3Title'),
      description: t('referral.step3Desc', {
        referrer: localizeDigits(referrerBonus, language),
        referee: localizeDigits(refereeBonus, language),
      }),
    },
  ];

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3 px-1 text-text-primary">{t('referral.howItWorks')}</h3>
      <div className="flex overflow-x-auto gap-3 pb-2 snap-x hide-scrollbar">
        {steps.map((step, idx) => (
          <div 
            key={idx} 
            className="min-w-[140px] flex-1 snap-start flex flex-col items-start p-4 rounded-xl bg-card-bg border border-card-border"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-secondary text-primary mb-2">
              {step.icon}
            </div>
            <h4 className="text-sm font-semibold text-text-primary mb-0.5">{step.title}</h4>
            <p className="text-xs text-text-secondary leading-tight">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
