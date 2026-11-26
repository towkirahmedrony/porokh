import React from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { SlidersHorizontal } from 'lucide-react';
import { localizedText } from '../services/questionBankMapper';
import {
  FilterPanel,
  FilterSelect,
  type FilterOption,
} from '@/shared/components/filters/FilterPanel';
import type {
  QuestionBankChapter,
  QuestionBankFilterState,
  QuestionBankInstitution,
  QuestionBankTopic,
} from '../types/questionBank';

interface QuestionFilterProps {
  filters: QuestionBankFilterState;
  chapters: QuestionBankChapter[];
  topics: QuestionBankTopic[];
  boards: QuestionBankInstitution[];
  colleges: QuestionBankInstitution[];
  admissions: QuestionBankInstitution[];
  onFilterChange: <K extends keyof QuestionBankFilterState>(
    key: K,
    value: QuestionBankFilterState[K]
  ) => void;
  onReset: () => void;
}

const YEARS = Array.from({ length: 15 }, (_, i) => {
  const year = new Date().getFullYear() - i;
  return { value: String(year), label: String(year) };
});

function ToggleChip(props: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={props.active}
      className={[
        'rounded-full border px-3 py-1.5 text-xs font-medium transition outline-none focus:ring-2 focus:ring-focus-ring focus:ring-offset-2 focus:ring-offset-app',
        props.active
          ? 'border-transparent bg-primary text-primary-foreground'
          : 'border-border-color bg-surface text-text-secondary hover:bg-secondary hover:text-text-primary',
      ].join(' ')}
    >
      {props.label}
    </button>
  );
}

export const QuestionFilter: React.FC<QuestionFilterProps> = ({
  filters, chapters, topics, boards, colleges, admissions, onFilterChange, onReset,
}) => {
  const { t, language } = useLanguage();

  const institutionList =
    filters.institutionType === 'board'
      ? boards
      : filters.institutionType === 'college'
        ? colleges
        : admissions;

  const sortOptions: FilterOption[] = [
    { value: 'newest', label: t('questionBank.newest') },
    { value: 'oldest', label: t('questionBank.oldest') },
    { value: 'most_attempted', label: t('questionBank.mostAttempted') },
    { value: 'least_attempted', label: t('questionBank.leastAttempted') },
  ];

  return (
    <FilterPanel
      title={t('questionBank.filter')}
      resetLabel={t('questionBank.reset')}
      onReset={onReset}
      search={{
        value: filters.search,
        onChange: (value) => onFilterChange('search', value),
        label: t('common.search'),
        placeholder: t('questionBank.search'),
      }}
      gridClassName="grid grid-cols-2 gap-3 xl:grid-cols-1"
      extra={
        <div className="space-y-3 border-t border-border-color pt-4">
          <div className="flex items-center gap-2 text-xs font-medium text-text-primary">
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            {t('questionBank.quickFilter')}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <ToggleChip
              active={filters.bookmarkedOnly}
              label={t('questionBank.saved')}
              onClick={() => onFilterChange('bookmarkedOnly', !filters.bookmarkedOnly)}
            />
            <ToggleChip
              active={filters.mistakesOnly}
              label={t('questionBank.mistakes')}
              onClick={() => onFilterChange('mistakesOnly', !filters.mistakesOnly)}
            />
            <ToggleChip
              active={filters.premiumOnly}
              label={t('questionBank.premium')}
              onClick={() => onFilterChange('premiumOnly', !filters.premiumOnly)}
            />
          </div>
        </div>
      }
    >
      <FilterSelect
        label={t('questionBank.chapter')}
        value={filters.chapterId}
        onChange={(value) => onFilterChange('chapterId', value)}
        options={[
          { value: '', label: t('questionBank.allChapters') },
          ...chapters.map((item) => ({
            value: item.id,
            label: localizedText(item.name_bn, item.name_en, language),
          })),
        ]}
      />

      <FilterSelect
        label={t('questionBank.topic')}
        value={filters.topicId}
        onChange={(value) => onFilterChange('topicId', value)}
        options={[
          { value: '', label: t('questionBank.allTopics') },
          ...topics.map((item) => ({
            value: item.id,
            label: localizedText(item.name_bn, item.name_en, language),
          })),
        ]}
      />

      <FilterSelect
        label={t('questionBank.source')}
        value={filters.institutionType}
        onChange={(value) => onFilterChange('institutionType', value)}
        options={[
          { value: '', label: t('questionBank.allSources') },
          { value: 'board', label: t('questionBank.board') },
          { value: 'college', label: t('questionBank.college') },
          { value: 'admission', label: t('questionBank.admission') },
        ]}
        searchThreshold={99}
      />

      {filters.institutionType ? (
        <FilterSelect
          label={
            filters.institutionType === 'board' ? t('questionBank.selectBoard') :
            filters.institutionType === 'college' ? t('questionBank.selectCollege') :
            t('questionBank.selectAdmission')
          }
          value={filters.institutionEiin}
          onChange={(value) => onFilterChange('institutionEiin', value)}
          options={[
            { value: '', label: t('questionBank.allSelect') },
            ...institutionList.map((item) => ({
              value: item.eiin || item.code || item.id,
              label: localizedText(item.name_bn, item.name_en, language),
            })),
          ]}
        />
      ) : null}

      <FilterSelect
        label={t('questionBank.year')}
        value={filters.year}
        onChange={(value) => onFilterChange('year', value)}
        options={[{ value: '', label: t('questionBank.allYears') }, ...YEARS]}
      />

      <FilterSelect
        label={t('questionBank.sort')}
        value={filters.sortBy}
        onChange={(value) =>
          onFilterChange('sortBy', value as QuestionBankFilterState['sortBy'])
        }
        options={sortOptions}
        searchThreshold={99}
      />
    </FilterPanel>
  );
};
