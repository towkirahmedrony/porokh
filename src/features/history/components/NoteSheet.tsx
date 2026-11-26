import React, { memo, useEffect, useState } from 'react';

import { SettingsBottomSheet } from '@/features/profile/components/SettingsBottomSheet';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';

interface Props {
  open: boolean;
  initialNote: string;
  isSaving: boolean;
  onClose: () => void;
  onSave: (note: string) => void;
}

const MAX_NOTE_LENGTH = 500;

/** A personal note lives on the bookmark row; it is never sent anywhere else. */
export const NoteSheet: React.FC<Props> = memo(
  ({ open, initialNote, isSaving, onClose, onSave }) => {
    const { language, t } = useLanguage();
    const [value, setValue] = useState(initialNote);

    useEffect(() => {
      if (open) setValue(initialNote);
    }, [open, initialNote]);

    return (
      <SettingsBottomSheet open={open} title={t('history.explorerNoteTitle')} onClose={onClose}>
        <div className="px-5">
          <label
            htmlFor="bookmark-note"
            className="block pb-2 text-[11px] leading-5 text-text-secondary"
          >
            {t('history.explorerNoteHint')}
          </label>
          <textarea
            id="bookmark-note"
            value={value}
            onChange={(event) => setValue(event.target.value.slice(0, MAX_NOTE_LENGTH))}
            rows={4}
            maxLength={MAX_NOTE_LENGTH}
            className="w-full resize-none rounded-xl border border-input-border bg-input-bg px-3 py-2 text-[13px] leading-7 text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          />
          <p className="pb-2 pt-1 text-right text-[11px] tabular-nums text-text-secondary">
            {localizeDigits(value.length, language)} / {localizeDigits(MAX_NOTE_LENGTH, language)}
          </p>
        </div>

        <div className="flex gap-2 border-t border-border-color px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] flex-1 rounded-xl border border-border-color text-[13px] font-semibold text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => onSave(value.trim())}
            disabled={isSaving}
            className="min-h-[44px] flex-1 rounded-xl bg-primary text-[13px] font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {t('history.explorerNoteSave')}
          </button>
        </div>
      </SettingsBottomSheet>
    );
  }
);

NoteSheet.displayName = 'NoteSheet';
