import React, { memo } from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { BookOpen } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { Subject } from '../types/content';
import { pickLang } from '@/shared/i18n/localize';

interface SubjectSelectorProps {
  isLoading: boolean;
  subjects: Pick<Subject, 'id' | 'name_bn' | 'name_en'>[];
  selectedSubject: string;
  onSelect: (val: string) => void;
}

export const SubjectSelector: React.FC<SubjectSelectorProps> = memo(({ isLoading, subjects, selectedSubject, onSelect }) => {
  const { language, t } = useLanguage();
  return (
    <div className="mb-5 w-full group">
      <label className="text-sm md:text-base font-semibold mb-2.5 flex items-center gap-2 text-text-primary">
        <BookOpen size={18} className="text-text-secondary group-focus-within:text-text-primary transition-colors" /> {t('exam.selectSubject')}
      </label>
      {isLoading ? (
        <Skeleton className="w-full h-[54px] rounded-xl bg-surface-elevated" />
      ) : (
        <div className="relative">
          <select 
            className="w-full p-4 text-[15px] md:text-base border border-input-border bg-input-bg text-text-primary rounded-xl appearance-none outline-none transition-all cursor-pointer shadow-sm hover:shadow-md focus:border-border-color focus:ring-1 focus:ring-focus-ring"
            value={selectedSubject}
            onChange={(e) => onSelect(e.target.value)}
          >
            <option value="" disabled className="bg-card-bg text-text-secondary">{t('exam.selectSubjectPlaceholder')}</option>
            {subjects.map(sub => (
              <option key={sub.id} value={sub.id} className="bg-card-bg text-text-primary">
                {pickLang(language, sub.name_bn, sub.name_en)}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-text-secondary">
            <svg className="h-5 w-5 transition-colors group-focus-within:text-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
});

SubjectSelector.displayName = 'SubjectSelector';
