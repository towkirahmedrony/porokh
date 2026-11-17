import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { ChevronRight, FileText, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getIconByName } from '@/shared/utils/iconMapper';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import BoardExamFilter from './BoardExamFilter';
import EmptyState from '@/shared/components/ui/EmptyState';
import { Subject, BoardExamPaper } from '../types/content';
import searchEmptyAnim from '@/assets/animations/empty-search.json';
import { supabase } from '@/shared/lib/supabase';
import toast from 'react-hot-toast';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { pickLang } from '@/shared/i18n/localize';
import { localizeBoardName } from '../utils/examLabels';
import { EXAM_TYPES } from '../constants/examTypes';

interface BoardExamTabProps {
  onViewChange: (isDetail: boolean) => void;
}

const BoardExamTab: React.FC<BoardExamTabProps> = ({ onViewChange }) => {
  const { language, t } = useLanguage();
  const [view, setView] = useState<'subject_list' | 'paper_list'>('subject_list');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  
  const [selectedBoard, setSelectedBoard] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1. Fetch Subjects using React Query
  const { 
    data: subjects = [], 
    isLoading: isLoadingSubjects, 
    error: subjectsError 
  } = useQuery({
    queryKey: ['subjects', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('id, name_bn, name_en, icon_url')
        .eq('is_active', true)
        .order('sequence', { ascending: true });

      if (error) throw error;
      return data as Subject[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // 2. Fetch Exam Papers using React Query
  const { 
    data: allPapers = [], 
    isLoading: isLoadingPapers, 
    error: papersError 
  } = useQuery({
    queryKey: ['exam_papers', 'board_exam', selectedSubject?.id],
    queryFn: async () => {
      if (!selectedSubject) return [];
      const { data, error } = await supabase
        .from('exam_papers')
        .select('*')
        .eq('subject_id', selectedSubject.id)
        .eq('category', EXAM_TYPES.board.databaseValue)
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as BoardExamPaper[];
    },
    enabled: !!selectedSubject && view === 'paper_list',
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Handle Query Errors
  useEffect(() => {
    if (subjectsError) {
      console.error("Error fetching subjects:", subjectsError);
      toast.error(t('exam.subjectsLoadError'));
    }
  }, [subjectsError]);

  useEffect(() => {
    if (papersError) {
      console.error("Error fetching exam papers:", papersError);
      toast.error(t('exam.papersLoadError'));
    }
  }, [papersError]);

  // 3. Client-side Filtering using useMemo (Derived State)
  const filteredPapers = useMemo(() => {
    return allPapers.filter((p) => {
      const metaData = p.meta_data;
      const matchBoard = selectedBoard ? metaData?.board === selectedBoard : true;
      const matchYear = selectedYear ? metaData?.year === selectedYear : true;
      const matchSearch = searchQuery 
        ? p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
          (metaData?.year && metaData.year.includes(searchQuery))
        : true;
      return matchBoard && matchYear && matchSearch;
    });
  }, [allPapers, selectedBoard, selectedYear, searchQuery]);

  const handleSubjectClick = useCallback((subject: Subject) => {
    setSelectedSubject(subject);
    setView('paper_list');
    onViewChange(true);
  }, [onViewChange]);

  const handleBack = useCallback(() => {
    setView('subject_list');
    setSelectedSubject(null);
    onViewChange(false);
    setSelectedBoard('');
    setSelectedYear('');
    setSearchQuery('');
  }, [onViewChange]);

  const startExam = useCallback((paperId: string) => {
    console.log("Starting Board Exam:", paperId);
    // TODO: Route to Exam Entry/Instruction page
  }, []);

  if (view === 'paper_list' && selectedSubject) {
    return (
      <div className="p-4 animate-in slide-in-from-right duration-300">
        <BoardExamFilter 
          subject={selectedSubject}
          selectedBoard={selectedBoard}
          setSelectedBoard={setSelectedBoard}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onBack={handleBack}
        />

        <div className="mt-4 space-y-3">
          {isLoadingPapers ? (
            Array(4).fill(0).map((_, i) => (
              <div 
                key={`skeleton-${i}`} 
                className="p-4 rounded-xl border border-card-border bg-card-bg space-y-3 animate-pulse"
              >
                <Skeleton className="h-5 w-3/4 bg-surface-elevated" />
                <div className="flex gap-3">
                  <Skeleton className="h-4 w-16 bg-surface-elevated" />
                  <Skeleton className="h-4 w-16 bg-surface-elevated" />
                </div>
              </div>
            ))
          ) : filteredPapers.length > 0 ? (
            filteredPapers.map((paper) => {
              const metaData = paper.meta_data;
              return (
                <div 
                  key={paper.id}
                  onClick={() => startExam(paper.id)}
                  className="group active:scale-[0.99] p-5 rounded-xl border border-card-border bg-card-bg transition-all cursor-pointer shadow-sm hover:bg-surface hover:border-primary"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium transition-colors line-clamp-2 text-text-primary group-hover:text-primary">
                      {paper.title} {metaData?.year && `(${metaData.year})`}
                    </h3>
                    {metaData?.board && (
                      <div className="px-2 py-1 rounded text-xs border border-border-color bg-badge-bg text-badge-text whitespace-nowrap">
                        {localizeBoardName(metaData.board, language)}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs mt-3 text-text-secondary">
                    <div className="flex items-center gap-1.5">
                      <FileText size={14} className="text-primary" />
                      <span>{paper.total_marks} {t('exam.marks')}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock size={14} />
                      <span>{paper.duration_min} {t('exam.minutes')}</span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyState 
              message={t('exam.noPapers')}
              subMessage={t('exam.noPapersHint')}
              animationData={searchEmptyAnim}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-20 animate-fade-in">
      {isLoadingSubjects ? (
        Array(5).fill(0).map((_, i) => (
          <div 
            key={`subject-skeleton-${i}`} 
            className="flex items-center justify-between p-4 rounded-xl border border-card-border bg-card-bg animate-pulse"
          >
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
              className="group p-5 flex items-center justify-between rounded-xl border border-card-border bg-card-bg transition-all cursor-pointer shadow-sm active:scale-[0.99] hover:bg-surface hover:border-primary"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center border border-border-color bg-surface text-primary transition-colors group-hover:border-primary">
                  <IconComponent size={20} strokeWidth={2} />
                </div>
                <h3 className="text-[15px] font-medium transition-colors text-text-primary group-hover:text-primary">
                  {pickLang(language, subject.name_bn, subject.name_en)}
                </h3>
              </div>
              <ChevronRight 
                className="transition-transform group-hover:translate-x-1 text-text-secondary group-hover:text-primary" 
                size={18} 
              />
            </div>
          );
        })
      )}
    </div>
  );
};

export default BoardExamTab;
