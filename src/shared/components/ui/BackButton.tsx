import React from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BackButtonProps {
  onClick?: () => void;
  className?: string;
}

export const BackButton: React.FC<BackButtonProps> = ({ onClick, className = '' }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleBack = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(-1); 
    }
  };

  return (
    <button
      onClick={handleBack}
      className={`flex items-center justify-center w-10 h-10 rounded-full transition-all hover:scale-105 bg-surface border border-border-color text-text-primary ${className}`}
      aria-label={t('common.back')}
      title={t('common.back')}
    >
      <ChevronLeft size={24} strokeWidth={2.5} />
    </button>
  );
};
