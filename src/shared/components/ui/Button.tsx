import React from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  className = '', 
  variant = 'primary', 
  size = 'md',
  isLoading = false,
  disabled,
  ...props 
}) => {
  const { t } = useLanguage();

  const baseStyle = "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95";
  
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg"
  };

  const getVariantClasses = () => {
    switch(variant) {
      case 'primary':
        return 'bg-primary text-primary-foreground';
      case 'secondary':
        return 'bg-secondary text-text-primary border border-border-color';
      case 'outline':
        return 'bg-transparent text-text-primary border-2 border-border-color hover:bg-surface';
      case 'danger':
        return 'bg-red-600 text-white hover:bg-red-700'; // Standard tailwind fallback for danger
      case 'ghost':
        return 'bg-transparent text-text-primary hover:bg-surface';
      default:
        return '';
    }
  };

  return (
    <button 
      className={`${baseStyle} ${sizes[size]} ${getVariantClasses()} ${className}`} 
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading ? t('common.loading') : children}
    </button>
  );
};

export default Button;
