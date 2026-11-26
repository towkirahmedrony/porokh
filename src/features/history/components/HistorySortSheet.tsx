import React, { memo } from 'react';
import {
  SettingsBottomSheet,
  SheetRadioRow,
} from '@/features/profile/components/SettingsBottomSheet';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import type { HistorySortOrder } from '../utils/historyCard';

interface Props {
  open: boolean;
  value: HistorySortOrder;
  onClose: () => void;
  onChange: (order: HistorySortOrder) => void;
}

export const HistorySortSheet: React.FC<Props> = memo(({ open, value, onClose, onChange }) => {
  const { t } = useLanguage();

  return (
    <SettingsBottomSheet open={open} title={t('history.sortTitle')} onClose={onClose}>
      <div role="radiogroup" aria-label={t('history.sortTitle')}>
        <SheetRadioRow
          checked={value === 'newest'}
          onSelect={() => {
            onChange('newest');
            onClose();
          }}
          label={t('history.sortNewest')}
        />
        <SheetRadioRow
          checked={value === 'oldest'}
          onSelect={() => {
            onChange('oldest');
            onClose();
          }}
          label={t('history.sortOldest')}
        />
      </div>
    </SettingsBottomSheet>
  );
});

HistorySortSheet.displayName = 'HistorySortSheet';
