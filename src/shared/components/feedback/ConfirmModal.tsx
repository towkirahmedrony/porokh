import React from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { useBackInterceptor } from '@/app/navigation/useBackInterceptor';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  loadingText?: string;
  isLoading?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
  loadingText,
  isLoading = false
}) => {
  // Defaults follow the active UI language; explicit props still win so callers
  // that already pass localised text are unaffected.
  const { t } = useLanguage();

  // Android Back dismisses this confirmation instead of leaving the page.
  useBackInterceptor(onCancel, isOpen);

  if (!isOpen) return null;

  const confirmLabel = confirmText ?? t('common.yes');
  const cancelLabel = cancelText ?? t('common.no');
  const loadingLabel = loadingText ?? t('common.pleaseWait');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity bg-black/60">
      <div className="w-full max-w-sm rounded-2xl p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200 bg-surface-elevated text-text-primary">
        <h3 className="text-xl font-bold mb-3">{title}</h3>
        <p className="mb-6 text-text-secondary">
          {message}
        </p>
        
        <div className="flex gap-4">
          <button 
            type="button"
            onClick={onCancel} 
            disabled={isLoading}
            className="flex-1 py-3 font-bold rounded-xl transition-colors disabled:opacity-50 bg-secondary text-text-primary hover:opacity-90" 
          >
            {cancelLabel}
          </button>
          <button 
            type="button"
            onClick={onConfirm} 
            disabled={isLoading}
            className="flex-1 py-3 font-bold rounded-xl transition-colors disabled:opacity-50 bg-primary text-primary-foreground hover:opacity-90" 
          >
            {isLoading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
