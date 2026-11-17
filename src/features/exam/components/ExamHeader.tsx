import React from 'react';
import { ArrowLeft, LucideIcon } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';

interface ExamHeaderProps {
  title: string;
  icon?: LucideIcon;
  iconColor?: string;
  onBack: () => void;
  rightContent?: React.ReactNode;
}

const ExamHeader: React.FC<ExamHeaderProps> = ({ title, icon: Icon, iconColor, onBack, rightContent }) => {
  const { t } = useLanguage();
  return (
    <div className="sticky top-0 z-40 backdrop-blur-xl px-4 py-3 flex items-center justify-between transition-colors shadow-sm bg-surface-elevated border-b border-border-color">
      <div className="flex items-center gap-3">
        <button 
          onClick={onBack}
          aria-label={t('common.back')}
          className="p-2 -ml-2 rounded-full transition-opacity hover:opacity-70 active:scale-95 text-text-primary"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="flex items-center gap-2 text-text-primary">
          {Icon && <Icon size={18} className={iconColor} />}
          <span className="font-['Noto_Sans_Bengali'] font-semibold text-lg">
            {title}
          </span>
        </div>
      </div>
      
      {rightContent && (
        <div className="flex items-center">
          {rightContent}
        </div>
      )}
    </div>
  );
};

export default ExamHeader;
