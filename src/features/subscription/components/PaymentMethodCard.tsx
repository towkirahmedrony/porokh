import React, { useState, useEffect, useCallback } from 'react';
import { Copy, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { PaymentMethod } from '../types/subscription';
import { useLanguage } from '@/shared/i18n/LanguageProvider';

interface PaymentMethodCardProps {
  method: PaymentMethod;
  isSelected: boolean;
  onSelect: () => void;
}

const PaymentMethodCard: React.FC<PaymentMethodCardProps> = ({ method, isSelected, onSelect }) => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  // Handle cleanup for setTimeout to prevent memory leaks on unmount
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (copied) {
      timeoutId = setTimeout(() => setCopied(false), 2000);
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [copied]);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!method?.number) return;

    try {
      await navigator.clipboard.writeText(method.number);
      setCopied(true);
      toast.success(t('premium.number_copied'));
    } catch {
      toast.error(t('premium.copy_failed'));
    }
  }, [method?.number, t]);

  if (!method) return null;

  const isBkash = method.id.toLowerCase() === 'bkash';
  // Using brand colors explicitly for bKash/Nagad recognition only
  const brandColor = isBkash ? '#e11471' : '#f97316'; 
  
  // Safe initial character extraction
  const brandInitial = method.name?.charAt(0)?.toUpperCase() || '?';

  return (
    <div 
      onClick={onSelect}
      className={`cursor-pointer rounded-xl border-2 p-4 transition-all duration-200 ${
        isSelected ? 'bg-surface-elevated' : 'bg-card-bg border-card-border'
      }`}
      style={{
        borderColor: isSelected ? brandColor : undefined
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-primary-foreground"
            style={{ backgroundColor: brandColor }}
          >
            {brandInitial}
          </div>
          <div>
            <h4 className="font-bold text-text-primary">{method.name}</h4>
            <span className="text-xs px-2 py-0.5 rounded bg-badge-bg text-badge-text">
              {method.type}
            </span>
          </div>
        </div>
        {isSelected && (
          <CheckCircle style={{ color: brandColor }} size={24} />
        )}
      </div>

      {isSelected && (
        <div className="mt-2 rounded-lg p-3 flex items-center justify-between border bg-surface border-border-color">
          <span className="font-mono text-lg font-semibold tracking-wider text-text-primary">
            {method.number}
          </span>
          <button 
            onClick={handleCopy}
            className="p-2 rounded-full transition-colors hover:bg-secondary text-text-secondary hover:text-text-primary"
            title={t('premium.copy_number')}
          >
            {copied ? (
               <CheckCircle size={18} className="text-primary" />
            ) : (
               <Copy size={18} />
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default React.memo(PaymentMethodCard);
