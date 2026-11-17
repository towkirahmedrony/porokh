import React, { useState, memo, useEffect, useCallback } from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { ChevronDown, ChevronRight, Check, ChevronLeft, Minus, ArrowRight, AlertCircle } from 'lucide-react';
import { Subject, Chapter } from '../types/content';
import { pickLang } from '@/shared/i18n/localize';

interface ChapterSelectionProps {
  subject: Subject;
  onBack: () => void;
  onProceed: (selectedTopicIds: string[]) => void;
}

// Extracted Checkbox Component
const Checkbox = memo(({ status, onClick }: { status: 'checked' | 'unchecked' | 'partial', onClick: (e: React.MouseEvent) => void }) => {
  let stateClasses = "bg-card-bg border-border-color text-transparent";
  
  if (status === 'checked') {
    stateClasses = "bg-primary border-primary text-primary-foreground";
  } else if (status === 'partial') {
    stateClasses = "bg-secondary border-border-color text-text-primary";
  }

  return (
    <button 
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      className={`w-6 h-6 rounded-md flex items-center justify-center transition-all border-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-focus-ring ${stateClasses}`}
    >
      {status === 'checked' && <Check size={16} strokeWidth={3} />}
      {status === 'partial' && <Minus size={16} strokeWidth={3} />}
    </button>
  );
});
Checkbox.displayName = 'Checkbox';

const ChapterSelection: React.FC<ChapterSelectionProps> = ({ subject, onBack, onProceed }) => {
  const { language, t } = useLanguage();
  const [expandedChapters, setExpandedChapters] = useState<string[]>([]);
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (selectedTopicIds.size > 0) setErrorMsg(null);
  }, [selectedTopicIds]);

  const toggleChapter = useCallback((chapterId: string) => {
    setExpandedChapters(prev => 
      prev.includes(chapterId) ? prev.filter(id => id !== chapterId) : [...prev, chapterId]
    );
  }, []);

  const isTopicSelected = useCallback((topicId: string) => selectedTopicIds.has(topicId), [selectedTopicIds]);

  const getChapterStatus = useCallback((chapter: Chapter) => {
    const totalTopics = chapter.children?.length || 0;
    if (totalTopics === 0) return 'unchecked';
    const selectedCount = chapter.children?.filter(t => selectedTopicIds.has(t.id)).length || 0;
    if (selectedCount === totalTopics) return 'checked';
    if (selectedCount > 0) return 'partial';
    return 'unchecked';
  }, [selectedTopicIds]);

  const getSubjectStatus = useCallback(() => {
    if (!subject.children || subject.children.length === 0) return 'unchecked';
    const allTopics = subject.children.flatMap(ch => ch.children || []);
    const totalTopics = allTopics.length;
    const selectedCount = allTopics.filter(t => selectedTopicIds.has(t.id)).length;
    if (totalTopics > 0 && selectedCount === totalTopics) return 'checked';
    if (selectedCount > 0) return 'partial';
    return 'unchecked';
  }, [subject.children, selectedTopicIds]);

  const handleTopicCheck = useCallback((topicId: string) => {
    setSelectedTopicIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(topicId)) newSet.delete(topicId); else newSet.add(topicId);
      return newSet;
    });
  }, []);

  const handleChapterCheck = useCallback((chapter: Chapter) => {
    setSelectedTopicIds(prev => {
      const newSet = new Set(prev);
      const status = getChapterStatus(chapter);
      const shouldSelect = status !== 'checked';
      chapter.children?.forEach(topic => {
        shouldSelect ? newSet.add(topic.id) : newSet.delete(topic.id);
      });
      return newSet;
    });
  }, [getChapterStatus]);

  const handleSubjectCheck = useCallback(() => {
    setSelectedTopicIds(prev => {
      const newSet = new Set(prev);
      const status = getSubjectStatus();
      const shouldSelect = status !== 'checked';
      subject.children?.forEach(chapter => {
        chapter.children?.forEach(topic => {
          shouldSelect ? newSet.add(topic.id) : newSet.delete(topic.id);
        });
      });
      return newSet;
    });
  }, [getSubjectStatus, subject.children]);

  const handleProceedClick = () => {
    if (selectedTopicIds.size === 0) {
      setErrorMsg(t('exam.topicRequired'));
      return;
    }
    onProceed(Array.from(selectedTopicIds));
  };

  return (
    <div className="w-full min-h-screen animate-in slide-in-from-right duration-300 flex flex-col items-center bg-app">
      <div className="w-full max-w-4xl p-4 md:p-6 lg:p-8 flex-1 pb-32">
        <div className="rounded-2xl p-4 mb-6 flex items-center justify-between sticky top-4 z-10 shadow-md border border-border-color backdrop-blur-md bg-surface/95">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack} 
              className="w-10 h-10 flex items-center justify-center rounded-full border border-border-color bg-surface hover:bg-surface-elevated text-text-secondary transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-focus-ring"
            >
              <ChevronLeft size={22} strokeWidth={2.5} />
            </button>
            <div className="flex flex-col">
              <h2 className="text-lg md:text-xl font-bold leading-tight text-text-primary">{pickLang(language, subject.name_bn, subject.name_en)}</h2>
              <span className="text-xs md:text-sm opacity-70 text-text-secondary">{t('exam.topicsSelected', { count: selectedTopicIds.size })}</span>
            </div>
          </div>
          <Checkbox status={getSubjectStatus()} onClick={handleSubjectCheck} />
        </div>

        <div className="space-y-4">
          {subject.children?.map((chapter) => {
            const isExpanded = expandedChapters.includes(chapter.id);
            const status = getChapterStatus(chapter);
            const totalTopics = chapter.children?.length || 0;
            const selectedCount = chapter.children?.filter(t => selectedTopicIds.has(t.id)).length || 0;

            return (
              <div 
                key={chapter.id} 
                className="rounded-xl border border-card-border overflow-hidden shadow-sm transition-all bg-card-bg"
              >
                <div 
                  className="flex items-center p-4 md:p-5 gap-4 transition-opacity hover:opacity-90 cursor-pointer"
                  onClick={() => toggleChapter(chapter.id)}
                >
                  <Checkbox status={status} onClick={() => handleChapterCheck(chapter)} />
                  <div className="flex-1 flex items-center justify-between">
                    <span className="font-semibold text-[15px] md:text-base text-text-primary">{pickLang(language, chapter.name_bn, chapter.name_en)}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs md:text-sm font-mono px-2 py-1 rounded-md bg-badge-bg text-badge-text">
                        {selectedCount}/{totalTopics}
                      </span>
                      {isExpanded ? (
                        <ChevronDown size={20} className="text-text-secondary opacity-50" />
                      ) : (
                        <ChevronRight size={20} className="text-text-secondary opacity-40" />
                      )}
                    </div>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="border-t border-border-color bg-surface">
                    {chapter.children?.map((topic) => {
                      const isSelected = isTopicSelected(topic.id);
                      return (
                        <div 
                          key={topic.id} 
                          onClick={() => handleTopicCheck(topic.id)}
                          className="flex items-center gap-4 py-3.5 md:py-4 px-4 md:px-5 pl-[3.5rem] md:pl-[4rem] cursor-pointer border-b border-border-color last:border-0 hover:bg-surface-elevated transition-colors"
                        >
                          <div className={`w-5 h-5 rounded-[4px] border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-primary border-primary text-primary-foreground' : 'bg-card-bg border-border-color text-transparent'}`}>
                             {isSelected && <Check size={12} strokeWidth={3} />}
                          </div>
                          <div className="flex-1 flex justify-between items-center">
                            <span className={`text-sm md:text-[15px] transition-colors ${isSelected ? 'font-semibold text-primary' : 'text-text-primary opacity-80'}`}>
                              {pickLang(language, topic.name_bn, topic.name_en)}
                            </span>
                            <span className="text-xs text-text-secondary opacity-60">
                               {t('exam.questionsCount', { count: topic.total_questions || 0 })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 w-full p-4 md:p-6 backdrop-blur-xl border-t border-border-color z-20 flex flex-col items-center justify-center bg-app/85">
        <div className="w-full max-w-4xl space-y-3">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-500 text-sm animate-in fade-in slide-in-from-bottom-2">
              <AlertCircle size={16} />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}
          <button 
            onClick={handleProceedClick}
            className={`w-full font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 text-base md:text-lg focus:outline-none focus:ring-4 focus:ring-focus-ring ${
              selectedTopicIds.size > 0 
                ? 'bg-primary text-primary-foreground hover:scale-[1.01] active:scale-95 cursor-pointer shadow-lg' 
                : 'bg-secondary text-text-secondary opacity-60 cursor-not-allowed'
            }`}
          >
            {t('exam.continue')}
            <ArrowRight size={22} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(ChapterSelection);
