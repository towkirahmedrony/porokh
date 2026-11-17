import React from 'react';
import { BookOpen } from 'lucide-react';
import { SubjectCard } from './SubjectCard';
import { SubjectReportData } from '../types/progress';
import { useLanguage } from '@/shared/i18n/LanguageProvider';

interface SubjectReportSectionProps {
  subjectReport: SubjectReportData[];
}

export const SubjectReportSection: React.FC<SubjectReportSectionProps> = ({ subjectReport }) => {
  const { t } = useLanguage();

  return (
    <div className="mt-4">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-text-primary">
        <BookOpen className="text-text-primary" /> {t('progress.subjectReportTitle')}
      </h2>
      
      {!subjectReport || subjectReport.length === 0 ? (
        <p className="text-sm italic text-text-secondary">
          {t('progress.subjectReportEmpty')}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {subjectReport.map((subject) => (
            <SubjectCard 
              key={subject.subject}
              subject={subject.subject} 
              score={Number(subject.score) || 0} 
              correct={subject.correct || 0} 
              wrong={subject.wrong || 0} 
              skipped={subject.skipped || 0} 
            />
          ))}
        </div>
      )}
    </div>
  );
};
