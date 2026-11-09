import React from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { APP_LANGUAGES, LANGUAGE_OPTION_LABELS } from '@/shared/i18n/messages';

interface LanguageSwitcherProps {
  className?: string;
}

/**
 * Language preference switch (বাংলা / English). Native buttons keep it
 * keyboard accessible and `aria-pressed` exposes the current selection to
 * assistive technology. The selection is applied immediately and persisted
 * through the app-level language preference (no page reload required).
 */
const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  className = '',
}) => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div
      role="group"
      aria-label={t('language.groupLabel')}
      className={`inline-flex shrink-0 items-center rounded-full border border-border-color bg-surface-elevated p-0.5 ${className}`}
    >
      {APP_LANGUAGES.map((option) => {
        const isActive = language === option;

        return (
          <button
            key={option}
            type="button"
            lang={option}
            onClick={() => setLanguage(option)}
            aria-pressed={isActive}
            title={LANGUAGE_OPTION_LABELS[option]}
            className={`rounded-full px-2.5 py-1.5 text-[11px] font-semibold leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card-bg sm:px-3 sm:text-xs ${
              option === 'bn' ? "font-['Noto_Sans_Bengali']" : 'font-sans'
            } ${
              isActive
                ? 'bg-badge-bg text-badge-text shadow-sm'
                : 'text-text-secondary hover:bg-secondary hover:text-text-primary'
            }`}
          >
            {LANGUAGE_OPTION_LABELS[option]}
          </button>
        );
      })}
    </div>
  );
};

export default LanguageSwitcher;
