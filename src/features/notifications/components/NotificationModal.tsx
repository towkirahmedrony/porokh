import React, { memo } from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { X } from 'lucide-react';
import notificationGif from '@/assets/animations/notifications.gif';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationModal: React.FC<NotificationModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/50">
      <div className="rounded-2xl w-full max-w-sm overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-200 bg-surface-elevated">
        <div className="flex justify-between items-center p-4 border-b border-border-color">
          <h3 className="font-semibold text-lg font-['Noto_Sans_Bengali'] text-text-primary">
            {t('notification.permissionTitle')}
          </h3>
          <button 
            onClick={onClose}
            className="p-1 rounded-full transition-colors hover:bg-secondary text-text-secondary hover:text-text-primary"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 text-center space-y-4">
          <div className="w-40 h-40 mx-auto">
            <img 
              src={notificationGif} 
              alt={t('notification.enableAlt')}
              className="w-full h-full object-contain"
            />
          </div>
          
          <p className="font-['Noto_Sans_Bengali'] leading-relaxed text-text-secondary">
            {t('notification.permissionGuide')}
          </p>
        </div>

        <div className="p-4 bg-secondary">
          <button 
            onClick={() => {
              onClose();
              window.location.reload(); 
            }}
            className="w-full py-3 rounded-xl font-medium font-['Noto_Sans_Bengali'] hover:opacity-90 transition-all shadow-lg shadow-primary/30 bg-primary text-primary-foreground"
          >
            {t('notification.reload')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(NotificationModal);
