import React from 'react';
import { BackButton } from '@/shared/components/ui/BackButton';

interface ModelPageHeaderProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
}

const ModelPageHeader: React.FC<ModelPageHeaderProps> = ({ title, subtitle, onBack }) => {
  return (
    <header className="sticky top-0 z-10 border-b border-border-color bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex min-h-14 w-full max-w-4xl items-center gap-3 px-3 py-2">
        <BackButton onClick={onBack} />
        <div className="min-w-0">
          <h1 className="truncate font-['Noto_Sans_Bengali'] text-lg font-bold leading-tight text-text-primary">
            {title}
          </h1>
          {subtitle && (
            <p className="truncate text-xs text-text-secondary">{subtitle}</p>
          )}
        </div>
      </div>
    </header>
  );
};

export default ModelPageHeader;
