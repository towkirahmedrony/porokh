import React from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { Filter, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { localizedText } from '../services/questionBankMapper';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Card } from '@/shared/components/ui/Card';
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

function SelectField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-text-secondary ml-1">{props.label}</span>
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="h-9 rounded-xl border border-input-border bg-input-bg px-2 text-[13px] text-text-primary outline-none transition focus:ring-2 focus:ring-focus-ring focus:border-transparent appearance-none"
      >
        {props.options.map((option) => (
          <option key={option.value || 'all'} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleChip(props: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
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
  const sortOptions: Array<{ value: QuestionBankFilterState['sortBy']; label: string }> = [
    { value: 'newest', label: t('questionBank.newest') },
    { value: 'oldest', label: t('questionBank.oldest') },
    { value: 'most_attempted', label: t('questionBank.mostAttempted') },
    { value: 'least_attempted', label: t('questionBank.leastAttempted') },
  ];
  return (
    <Card className="rounded-3xl border border-card-border bg-card-bg p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-secondary p-2 text-text-primary">
            <Filter className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-text-primary">{t('questionBank.filter')}</h3>
        </div>

        <Button
          variant="ghost"
          onClick={onReset}
          className="h-8 rounded-xl px-2.5 text-xs"
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          {t('questionBank.reset')}
        </Button>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <Input
            value={filters.search}
            onChange={(event) => onFilterChange('search', event.target.value)}
            placeholder={t('questionBank.search')}
            className="h-10 rounded-xl pl-9 bg-input-bg border-input-border text-sm text-text-primary focus:ring-focus-ring"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
          <SelectField
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

          <SelectField
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

          <SelectField
            label={t('questionBank.source')}
            value={filters.institutionType}
            onChange={(value) => onFilterChange('institutionType', value)}
            options={[
              { value: '', label: t('questionBank.allSources') },
              { value: 'board', label: t('questionBank.board') },
              { value: 'college', label: t('questionBank.college') },
              { value: 'admission', label: t('questionBank.admission') },
            ]}
          />

          {filters.institutionType && (
            <SelectField
              label={
                filters.institutionType === 'board' ? t('questionBank.selectBoard') :
                filters.institutionType === 'college' ? t('questionBank.selectCollege') :
                t('questionBank.selectAdmission')
              }
              value={filters.institutionEiin}
              onChange={(value) => onFilterChange('institutionEiin', value)}
              options={[
                { value: '', label: t('questionBank.allSelect') },
                ...(filters.institutionType === 'board' ? boards :
                   filters.institutionType === 'college' ? colleges :
                   admissions).map((item) => ({
                   value: item.eiin || item.code || item.id,
                   label: localizedText(item.name_bn, item.name_en, language),
                })),
              ]}
            />
          )}

          <SelectField
            label={t('questionBank.year')}
            value={filters.year}
            onChange={(value) => onFilterChange('year', value)}
            options={[
              { value: '', label: t('questionBank.allYears') },
              ...YEARS,
            ]}
          />

          <SelectField
            label={t('questionBank.sort')}
            value={filters.sortBy}
            onChange={(value) => onFilterChange('sortBy', value as QuestionBankFilterState['sortBy'])}
            options={sortOptions}
          />
        </div>

        <div className="space-y-3 border-t border-border-color pt-4">
          <div className="flex items-center gap-2 text-xs font-medium text-text-primary">
            <SlidersHorizontal className="h-3.5 w-3.5" />
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
      </div>
    </Card>
  );
};
