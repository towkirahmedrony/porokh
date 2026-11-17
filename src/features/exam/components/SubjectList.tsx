import React, { memo } from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { ChevronRight, LayoutGrid, Lock } from 'lucide-react';
import { useCurriculumTree } from '../hooks/useContentData';
import { getIconByName } from '@/shared/utils/iconMapper';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { usePaywall } from '@/features/access/context/PaywallProvider';
import { pickLang } from '@/shared/i18n/localize';

interface SubjectListProps {
  onSelect: (id: string) => void;
}

export interface CurriculumSubject {
  id: string;
  name_bn?: string;
  name_en?: string | null;
  title?: string;
  icon_url?: string | null;
  is_locked?: boolean | null;
  is_premium?: boolean | null;
}

const SubjectList: React.FC<SubjectListProps> = memo(({ onSelect }) => {
  const { language, t } = useLanguage();
  const { openPaywall } = usePaywall();
  const { data: subjects, isLoading } = useCurriculumTree();
  if (isLoading) {
  return (
      <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-7xl mx-auto w-full">
         <Skeleton className="h-[88px] w-full rounded-2xl bg-surface-elevated" />
         <Skeleton className="h-[88px] w-full rounded-2xl bg-surface-elevated" />
         <Skeleton className="h-[88px] w-full rounded-2xl bg-surface-elevated hidden md:block" />
      </div>
    );
  }

  if (!subjects || subjects.length === 0) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-color m-4 max-w-3xl mx-auto">
        <LayoutGrid size={48} className="mb-4 text-text-secondary" />
        <h3 className="text-lg font-semibold text-text-primary">{t('exam.noSubjects')}</h3>
        <p className="text-sm mt-1 text-text-secondary">{t('exam.tryAgainLater')}</p>
      </div>
    );
  }

  return (
    <div className="w-full flex justify-center p-4 md:p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        {subjects.map((subject: CurriculumSubject) => {
          const IconComponent = getIconByName(subject.icon_url ?? 'default');
          
          return (
            <button
              key={subject.id}
              onClick={() => {
                if (subject.is_locked) {
                  openPaywall({ reason: 'premium_content' });
                  return;
                }
                onSelect(subject.id);
              }}
              aria-label={
                subject.is_locked
                  ? `${pickLang(language, subject.name_bn, subject.name_en) || subject.title || ''} — ${t('premium.a11y_locked')}`
                  : undefined
              }
              aria-disabled={subject.is_locked || undefined}
              className={`flex items-center gap-4 p-4 md:p-5 rounded-2xl border transition-all group text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-focus-ring ${
                subject.is_locked
                  ? 'border-primary/30 bg-card-bg/60 opacity-80 hover:opacity-100'
                  : 'border-card-border bg-card-bg hover:shadow-md hover:-translate-y-0.5'
              }`}
            >
              <div className="h-14 w-14 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner bg-badge-bg text-badge-text">
                <IconComponent size={26} strokeWidth={2.5} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold font-['Noto_Sans_Bengali'] text-[17px] md:text-[19px] leading-tight text-text-primary">
                  {pickLang(language, subject.name_bn, subject.name_en) || subject.title || t('exam.untitledSubject')}
                </h3>
              </div>
              {subject.is_locked ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
                  <Lock size={11} />
                  {t('premium.locked_label')}
                </span>
              ) : null}
              <div className="w-8 h-8 rounded-full flex items-center justify-center transition-colors group-hover:bg-surface-elevated">
                <ChevronRight size={20} className="text-text-secondary group-hover:text-text-primary transition-colors" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});

SubjectList.displayName = 'SubjectList';
export default SubjectList;
