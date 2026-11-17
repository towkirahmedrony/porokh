import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { getIconByName } from '@/shared/utils/iconMapper';
import ChapterSelection from '../ChapterSelection';
import ExamConfiguration, { ExamConfig } from '../ExamConfiguration';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { Subject } from '../../types/content';
import { useCurriculumTree } from '../../hooks/useContentData';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { pickLang } from '@/shared/i18n/localize';

interface LegacyModelTestFlowProps {
  onViewChange: (isDetail: boolean) => void;
}

type ViewState = 'subject_list' | 'chapter_selection' | 'exam_config';

const LegacyModelTestFlow: React.FC<LegacyModelTestFlowProps> = ({ onViewChange }) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [view, setView] = useState<ViewState>('subject_list');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  
  const { data: subjects = [], isLoading: loading } = useCurriculumTree();

  const handleSubjectClick = useCallback((subject: Subject) => {
    setSelectedSubject(subject);
    setView('chapter_selection');
    onViewChange(true);
  }, [onViewChange]);

  const handleBackToSubjectList = useCallback(() => {
    setView('subject_list');
    setSelectedSubject(null);
    onViewChange(false);
  }, [onViewChange]);

  const handleBackToSelection = useCallback(() => {
    setView('chapter_selection');
  }, []);

  const handleProceedToConfig = useCallback((topicIds: string[]) => {
    setSelectedTopicIds(topicIds);
    setView('exam_config');
  }, []);

  const handleStartExam = useCallback((config: ExamConfig) => {
    const examRoute = selectedSubject?.slug ? `/exam/live/${selectedSubject.slug}` : '/exam/live';
    
    navigate(examRoute, { 
      state: { 
        config: config,
        topics: selectedTopicIds,
        subjectName: pickLang(language, selectedSubject?.name_bn, selectedSubject?.name_en)
      } 
    });
  }, [navigate, selectedTopicIds, selectedSubject, language]);

  if (view === 'exam_config') {
    return (
      <ExamConfiguration 
        topicCount={selectedTopicIds.length}
        onBack={handleBackToSelection}
        onStartExam={handleStartExam}
      />
    );
  }

  if (view === 'chapter_selection' && selectedSubject) {
    return (
      <ChapterSelection 
        subject={selectedSubject} 
        onBack={handleBackToSubjectList} 
        onProceed={handleProceedToConfig} 
      />
    );
  }

  return (
    <div className="space-y-3 pb-20 animate-fade-in">
      {loading ? (
        Array.from({ length: 5 }).map((_, i) => (
          <div key={`skeleton-${i}`} className="flex items-center justify-between p-4 rounded-xl border border-card-border bg-card-bg">
             <div className="flex items-center gap-4 w-full">
               <Skeleton className="h-10 w-10 rounded-lg bg-surface-elevated" />
               <Skeleton className="h-4 w-1/2 bg-surface-elevated" />
             </div>
          </div>
        ))
      ) : (
        subjects.map((subject) => {
          const IconComponent = getIconByName(subject.icon_url);
          return (
            <div
              key={subject.id}
              onClick={() => handleSubjectClick(subject)}
              className="group active:scale-[0.99] rounded-xl p-5 flex items-center justify-between border border-card-border bg-card-bg transition-all cursor-pointer shadow-sm hover:bg-surface-elevated"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center border border-border-color bg-surface transition-colors text-text-primary">
                  <IconComponent size={20} strokeWidth={2} />
                </div>
                <h3 className="text-[15px] font-medium transition-colors text-text-primary">
                  {pickLang(language, subject.name_bn, subject.name_en)}
                </h3>
              </div>
              <ChevronRight className="transition-transform group-hover:translate-x-1 text-text-secondary" size={18} />
            </div>
          );
        })
      )}
    </div>
  );
};

export default LegacyModelTestFlow;
