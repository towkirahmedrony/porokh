import React from 'react';
import { Trash2 } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { useBackInterceptor } from '@/app/navigation/useBackInterceptor';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteModal: React.FC<Props> = ({ isOpen, onClose, onConfirm }) => {
  const { t } = useLanguage();

  // Android Back cancels the deletion prompt instead of navigating away.
  useBackInterceptor(onClose, isOpen);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4 animate-in fade-in bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-delete-modal-title"
    >
      <div className="bg-surface-elevated border border-border-color p-6 rounded-2xl w-full max-w-sm shadow-xl">
        <div className="flex flex-col items-center text-center">
          <div className="bg-surface border border-border-color text-accent w-12 h-12 rounded-full flex items-center justify-center mb-4">
            <Trash2 className="w-6 h-6" aria-hidden="true" />
          </div>
          <h3
            id="history-delete-modal-title"
            className="text-text-primary text-lg font-bold mb-2"
          >
            {t('history.deleteTitle')}
          </h3>
          <p className="text-text-secondary text-sm mb-6">
            {t('history.deleteMessage')}
          </p>
          <div className="flex w-full gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="text-text-primary bg-surface border border-border-color hover:bg-surface-elevated flex-1 py-2.5 rounded-xl font-medium transition-colors"
            >
              {t('history.deleteNo')}
            </button>
            <button 
              type="button"
              onClick={onConfirm}
              className="bg-primary text-primary-foreground hover:opacity-90 flex-1 py-2.5 rounded-xl font-medium transition-colors shadow-lg"
            >
              {t('history.deleteYes')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
