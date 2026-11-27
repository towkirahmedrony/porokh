import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import { Button } from '@/shared/components/ui/Button';
import type {
  QuestionBankFacetOption,
  QuestionBankFacets,
  QuestionBankFilterState,
} from '../types/questionBank';

interface BankFilterSheetProps {
  open: boolean;
  facets: QuestionBankFacets;
  filters: QuestionBankFilterState;
  activeCount: number;
  onClose: () => void;
  onFilterChange: <K extends keyof QuestionBankFilterState>(
    key: K,
    value: QuestionBankFilterState[K]
  ) => void;
  onReset: () => void;
}

interface FacetSectionProps {
  title: string;
  allLabel: string;
  options: QuestionBankFacetOption[];
  selected: string;
  onSelect: (id: string) => void;
}

function FacetSection({ title, allLabel, options, selected, onSelect }: FacetSectionProps) {
  const { language } = useLanguage();
  if (options.length === 0 && !selected) return null;

  const label = (option: QuestionBankFacetOption) =>
    [option.labelBn, option.labelEn].filter(Boolean).length === 0
      ? option.id
      : language === 'bn'
        ? option.labelBn || option.labelEn || option.id
        : option.labelEn || option.labelBn || option.id;

  return (
    <section className="space-y-1.5">
      <h3 className="px-1 text-[11px] font-bold uppercase tracking-wide text-text-secondary">
        {title}
      </h3>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onSelect('')}
          aria-pressed={selected === ''}
          className={`min-h-9 rounded-full border px-3 text-[11px] font-bold transition-colors ${
            selected === ''
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border-color bg-surface text-text-secondary'
          }`}
        >
          {allLabel}
        </button>

        {options.map((option) => {
          const active = selected === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(active ? '' : option.id)}
              aria-pressed={active}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium transition-colors ${
                active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border-color bg-surface text-text-secondary'
              }`}
            >
              <span className="max-w-[16ch] truncate">{label(option)}</span>
              <span className="text-[10px] font-bold opacity-70">
                {localizeDigits(option.count, language)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/**
 * One sheet for every filter, so the list keeps the full screen at 360px.
 *
 * Options come from the facet RPC, which means an option appears only when it
 * holds at least one question for the current tab, and its number is what the
 * student would actually get.
 */
export function BankFilterSheet({
  open,
  facets,
  filters,
  activeCount,
  onClose,
  onFilterChange,
  onReset,
}: BankFilterSheetProps) {
  const { t } = useLanguage();
  if (!open) return null;

  const isAdmission = filters.level === 'admission';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label={t('questionBank.closeFilters')}
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('questionBank.filters', { count: String(activeCount) })}
        className="relative flex max-h-[82vh] w-full max-w-lg flex-col rounded-t-[24px] border-t border-border-color bg-app"
      >
        <div className="flex items-center justify-between border-b border-border-color px-4 py-3">
          <h2 className="text-sm font-bold text-text-primary">
            {t('questionBank.filter')}
            {activeCount > 0 ? ` · ${activeCount}` : ''}
          </h2>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={onReset}
              className="h-9 rounded-lg px-2 text-[11px] font-bold text-text-secondary"
            >
              {t('questionBank.reset')}
            </Button>
            <Button onClick={onClose} className="h-9 rounded-lg px-3 text-[11px] font-bold">
              {t('questionBank.applyFilters')}
            </Button>
          </div>
        </div>

        <div className="space-y-4 overflow-y-auto px-3 py-3">
          {isAdmission && (
            <>
              <FacetSection
                title={t('questionBank.university')}
                allLabel={t('questionBank.allUniversities')}
                options={facets.institution}
                selected={filters.universityId}
                onSelect={(id) => onFilterChange('universityId', id)}
              />
              <FacetSection
                title={t('questionBank.unit')}
                allLabel={t('questionBank.allUnits')}
                options={facets.admission_unit}
                selected={filters.admissionUnitId}
                onSelect={(id) => onFilterChange('admissionUnitId', id)}
              />
              <FacetSection
                title={t('questionBank.year')}
                allLabel={t('questionBank.allYears')}
                options={facets.exam_year}
                selected={filters.year}
                onSelect={(id) => onFilterChange('year', id)}
              />
            </>
          )}

          <FacetSection
            title={t('questionBank.subject')}
            allLabel={t('questionBank.allSubjects')}
            options={facets.subject}
            selected={filters.subjectId}
            onSelect={(id) => onFilterChange('subjectId', id)}
          />

          {filters.subjectId && (
            <FacetSection
              title={t('questionBank.chapter')}
              allLabel={t('questionBank.allChapters')}
              options={facets.chapter}
              selected={filters.chapterId}
              onSelect={(id) => onFilterChange('chapterId', id)}
            />
          )}

          {filters.chapterId && (
            <FacetSection
              title={t('questionBank.topic')}
              allLabel={t('questionBank.allTopics')}
              options={facets.topic}
              selected={filters.topicId}
              onSelect={(id) => onFilterChange('topicId', id)}
            />
          )}

          <section className="space-y-1.5">
            <h3 className="px-1 text-[11px] font-bold uppercase tracking-wide text-text-secondary">
              {t('questionBank.quickFilter')}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['bookmarkedOnly', t('questionBank.saved')],
                  ['mistakesOnly', t('questionBank.mistakes')],
                  ['premiumOnly', t('questionBank.premium')],
                ] as const
              ).map(([key, label]) => {
                const active = filters[key];
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onFilterChange(key, !active)}
                    className={`min-h-9 rounded-full border px-3 text-[11px] font-bold transition-colors ${
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border-color bg-surface text-text-secondary'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
