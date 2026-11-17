import React, { memo } from 'react';
import { Search, ChevronDown, ChevronLeft, Calendar, Building2 } from 'lucide-react';
import { Subject } from '../types/content';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { pickLang } from '@/shared/i18n/localize';
import { localizeBoardName } from '../utils/examLabels';

interface BoardExamFilterProps {
  subject: Subject;
  selectedBoard: string;
  setSelectedBoard: (board: string) => void;
  selectedYear: string;
  setSelectedYear: (year: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onBack: () => void;
}

const BOARDS = [
  'ঢাকা বোর্ড', 'রাজশাহী বোর্ড', 'কুমিল্লা বোর্ড', 
  'যশোর বোর্ড', 'চট্টগ্রাম বোর্ড', 'বরিশাল বোর্ড', 
  ' সিলেট বোর্ড', 'দিনাজপুর বোর্ড', 'ময়মনসিংহ বোর্ড', 
  'মাদ্রাসা বোর্ড', 'কারিগরি বোর্ড'
] as const;

const YEARS = ['2025', '2024', '2023', '2022', '2021'] as const;

const BoardExamFilter: React.FC<BoardExamFilterProps> = memo(({
  subject,
  selectedBoard,
  setSelectedBoard,
  selectedYear,
  setSelectedYear,
  searchQuery,
  setSearchQuery,
  onBack
}) => {
  const { t, language } = useLanguage();

  return (
    <div className="space-y-4">
      
      {/* Header with Circular Back Button */}
      <div className="flex items-center gap-4 p-4 rounded-xl border shadow-sm sticky top-0 z-10 bg-card-bg border-card-border">
        <button 
          onClick={onBack} 
          className="w-10 h-10 flex items-center justify-center rounded-full border transition-all active:scale-95 bg-surface-elevated border-border-color text-text-secondary hover:bg-surface hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus-ring"
          aria-label={t('common.back')}
        >
          <ChevronLeft size={22} strokeWidth={2.5} />
        </button>
        <div>
          <h2 className="text-lg font-bold leading-tight text-text-primary">
            {pickLang(language, subject.name_bn, subject.name_en)}
          </h2>
          <p className="text-xs text-text-secondary">
            {t('exam.searchBoardQuestions')}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-xl border space-y-4 bg-surface border-border-color">
        
        <div className="grid grid-cols-2 gap-3">
          {/* Board Dropdown */}
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-text-secondary">
              <Building2 size={16} />
            </div>
            <select
              value={selectedBoard}
              onChange={(e) => setSelectedBoard(e.target.value)}
              className="w-full text-sm rounded-lg pl-9 pr-8 py-3 border appearance-none outline-none transition-all bg-input-bg text-text-primary border-input-border focus:ring-1 focus:border-focus-ring focus:ring-focus-ring"
            >
              <option value="">{t('exam.allBoards')}</option>
              {BOARDS.map(board => (
                <option key={board} value={board}>{localizeBoardName(board, language)}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-text-secondary">
              <ChevronDown size={14} />
            </div>
          </div>

          {/* Year Dropdown */}
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-text-secondary">
              <Calendar size={16} />
            </div>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full text-sm rounded-lg pl-9 pr-8 py-3 border appearance-none outline-none transition-all bg-input-bg text-text-primary border-input-border focus:ring-1 focus:border-focus-ring focus:ring-focus-ring"
            >
              <option value="">{t('exam.allYears')}</option>
              {YEARS.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-text-secondary">
              <ChevronDown size={14} />
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none transition-colors text-text-secondary group-focus-within:text-text-primary">
            <Search size={18} />
          </div>
          <input
            type="text"
            placeholder={t('exam.searchPapers')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg pl-10 pr-4 py-3 border outline-none transition-all bg-input-bg text-text-primary border-input-border focus:ring-1 focus:border-focus-ring focus:ring-focus-ring placeholder:text-text-secondary"
          />
        </div>
      </div>
    </div>
  );
});

BoardExamFilter.displayName = 'BoardExamFilter';

export default BoardExamFilter;
