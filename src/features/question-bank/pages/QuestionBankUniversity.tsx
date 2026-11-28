import { useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import UniversityLogo from '@/features/admission/components/UniversityLogo';
import { HubRow, HubRowList } from '../components/hub/HubRow';
import { HubSection } from '../components/hub/HubSection';
import { useQuestionBankHub } from '../hooks/useQuestionBankHub';
import { useUniversityLogoMap } from '../hooks/useUniversityLogoMap';
import { fetchQuestionBankFacets } from '../services/questionBankLevelService';
import {
  hubAllUniversitiesHref,
  hubUniversityHref,
  hubUniversityYearHref,
} from '../utils/questionBankHub';
import {
  DEFAULT_QUESTION_BANK_FILTERS,
  type QuestionBankFilterState,
} from '../types/questionBank';

/**
 * One university's admission bank: its units, then its exam years, then the
 * question list preset to the three.
 *
 * The unit and year counts are the same facet RPC the filter sheet already
 * reads, called with the university fixed. Reusing it is why the numbers on this
 * page and the numbers in the sheet cannot drift apart.
 */
export default function QuestionBankUniversity() {
  const { institutionId = '' } = useParams<{ institutionId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t, language } = useLanguage();

  const unitId = searchParams.get('unit') ?? '';
  const hub = useQuestionBankHub('admission');
  const logoById = useUniversityLogoMap(true);

  const university = useMemo(() => {
    const varsity = hub.payload.sections.find(
      (section) => section.kind === 'track' && section.track === 'varsity'
    );
    const rows = varsity && varsity.kind === 'track' ? varsity.universities : [];
    return rows.find((row) => row.id === institutionId) ?? null;
  }, [hub.payload, institutionId]);

  const filters = useMemo<QuestionBankFilterState>(
    () => ({
      ...DEFAULT_QUESTION_BANK_FILTERS,
      level: 'admission',
      allTracks: true,
      universityId: institutionId,
      admissionUnitId: unitId,
    }),
    [institutionId, unitId]
  );

  const facetsQuery = useQuery({
    queryKey: ['question-bank', 'facets', filters],
    queryFn: () => fetchQuestionBankFacets(filters),
    enabled: Boolean(institutionId),
    staleTime: 1000 * 60 * 2,
  });

  const facets = facetsQuery.data;
  const units = facets?.admission_unit ?? [];
  const years = facets?.exam_year ?? [];
  const selectedUnit = units.find((unit) => unit.id === unitId) ?? null;

  const selectUnit = (nextUnitId: string) => {
    const next = new URLSearchParams(searchParams);
    if (nextUnitId) next.set('unit', nextUnitId);
    else next.delete('unit');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="min-h-full bg-app pb-24">
      <div className="mx-auto max-w-2xl px-4 pt-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigate('/question-bank?mode=admission')}
            aria-label={t('questionBank.hub.back')}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-text-secondary transition-colors active:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          {university && (
            <UniversityLogo
              logoUrl={logoById[institutionId] ?? null}
              name={university.labelBn}
              shortName={university.shortName}
              className="h-9 w-9 rounded-xl"
              imageClassName="h-6 w-6"
            />
          )}
          <h1 className="min-w-0 flex-1 truncate text-[17px] font-extrabold text-text-primary">
            {university?.labelBn ?? t('questionBank.university')}
          </h1>
        </div>

        {facetsQuery.isError ? (
          <div
            role="alert"
            className="mt-4 rounded-2xl border border-border-color bg-card-bg px-4 py-6 text-center"
          >
            <p className="text-[13px] font-semibold text-text-primary">
              {t('questionBank.hub.loadError')}
            </p>
            <button
              type="button"
              onClick={() => void facetsQuery.refetch()}
              className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border-color bg-surface px-4 text-[12px] font-bold text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              {t('questionBank.tryAgain')}
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-5">
            {university && (
              <HubRowList className="border-primary/25 bg-primary/[0.04]">
                <HubRow
                  label={t('questionBank.hub.allQuestions')}
                  count={university.count}
                  href={hubUniversityHref(institutionId)}
                />
              </HubRowList>
            )}

            {(facetsQuery.isPending || units.length > 0) && (
              <HubSection
                title={t('questionBank.hub.units')}
                meta={
                  selectedUnit
                    ? selectedUnit.labelBn ?? undefined
                    : t('questionBank.allUnits')
                }
              >
                <HubRowList>
                  {selectedUnit && (
                    <HubRow
                      label={t('questionBank.allUnits')}
                      onClick={() => selectUnit('')}
                    />
                  )}
                  {facetsQuery.isPending ? (
                    <HubRow label={t('common.loading')} />
                  ) : (
                    units.map((unit) => (
                      <HubRow
                        key={unit.id}
                        label={unit.labelBn ?? unit.id}
                        count={unit.count}
                        onClick={() => selectUnit(unit.id)}
                      />
                    ))
                  )}
                </HubRowList>
              </HubSection>
            )}

            {(facetsQuery.isPending || years.length > 0) && (
              <HubSection title={t('questionBank.hub.years')}>
                <HubRowList>
                  {facetsQuery.isPending ? (
                    <HubRow label={t('common.loading')} />
                  ) : (
                    years.map((year) => (
                      <HubRow
                        key={year.id}
                        label={localizeDigits(year.labelBn ?? year.id, language)}
                        count={year.count}
                        href={hubUniversityYearHref(institutionId, unitId, year.id)}
                      />
                    ))
                  )}
                </HubRowList>
              </HubSection>
            )}

            <button
              type="button"
              onClick={() => navigate(hubAllUniversitiesHref())}
              className="min-h-11 w-full rounded-xl text-[12px] font-bold text-text-secondary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {t('questionBank.allUniversities')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
