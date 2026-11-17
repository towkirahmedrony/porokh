import React from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { Sun, Moon, MonitorSmartphone } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

const ThemeToggle: React.FC = () => {
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-1 p-1 bg-surface border border-border-color rounded-lg">
      <button
        onClick={() => setTheme('light')}
        className={`flex items-center justify-center p-1.5 rounded-md transition-all ${
          theme === 'light' 
            ? 'bg-surface-elevated shadow-sm text-text-primary' 
            : 'text-text-secondary hover:text-text-primary bg-transparent'
        }`}
        title={t('theme.lightMode')}
        aria-label={t('theme.lightMode')}
      >
        <Sun size={18} />
      </button>
      
      <button
        onClick={() => setTheme('dark')}
        className={`flex items-center justify-center p-1.5 rounded-md transition-all ${
          theme === 'dark' 
            ? 'bg-surface-elevated shadow-sm text-text-primary' 
            : 'text-text-secondary hover:text-text-primary bg-transparent'
        }`}
        title={t('theme.darkMode')}
        aria-label={t('theme.darkMode')}
      >
        <Moon size={18} />
      </button>
      
      <button
        onClick={() => setTheme('system')}
        className={`flex items-center justify-center p-1.5 rounded-md transition-all ${
          theme === 'system' 
            ? 'bg-surface-elevated shadow-sm text-text-primary' 
            : 'text-text-secondary hover:text-text-primary bg-transparent'
        }`}
        title={t('theme.systemMode')}
        aria-label={t('theme.systemMode')}
      >
        <MonitorSmartphone size={18} />
      </button>
    </div>
  );
};

export default ThemeToggle;
