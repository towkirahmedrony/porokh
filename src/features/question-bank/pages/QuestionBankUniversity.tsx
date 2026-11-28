import { useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronLeft, ChevronRight, FileText, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import UniversityLogo from '@/features/admission/components/UniversityLogo';
import { HubLogoTile } from '../components/hub/HubLogoTile';
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
 * The units are tiles rather than rows because they are the first choice on
 * this screen and a phone fits all of them above the fold; the years below stay
 * rows, since each one is a paper with a single number beside it.
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

  const questionMeta = (count: number) =>
    t('questionBank.hub.questionMeta', {
      count: localizeDigits(count, language),
    });

  const selectUnit = (nextUnitId: string) => {
    const next = new URLSearchParams(searchParams);
    if (nextUnitId) next.set('unit', nextUnitId);
    else next.delete('unit');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="min-h-full bg-app pb-24">
      <div className="mx-auto w-full max-w-3xl pt-1">
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
          <div className="mt-3 space-y-6">
            {university && (
              <Link
                to={hubUniversityHref(institutionId)}
                className="!no-underline [text-decoration-line:none!important] flex items-center gap-3 rounded-[22px] border border-primary/20 bg-primary/[0.08] px-3.5 py-3.5 transition-colors active:bg-primary/[0.12] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-[0_2px_10px_rgba(15,23,42,0.10)]">
                  <FileText className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-extrabold text-text-primary">
                    {t('questionBank.hub.allQuestions')}
                  </span>
                  <span className="mt-0.5 block text-[11px] font-semibold text-text-secondary">
                    {questionMeta(university.count)}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
              </Link>
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
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {facetsQuery.isPending ? (
                    [0, 1, 2, 3].map((index) => (
                      <div
                        key={index}
                        className="h-[164px] animate-pulse rounded-[26px] border border-card-border bg-card-bg"
                      />
                    ))
                  ) : (
                    <>
                      {selectedUnit && (
                        <HubLogoTile
                          label={t('questionBank.allUnits')}
                          meta={questionMeta(university?.count ?? 0)}
                          logoUrl={logoById[institutionId] ?? null}
                          tone="primary"
                          onClick={() => selectUnit('')}
                        />
                      )}
                      {units.map((unit) => (
                        <HubLogoTile
                          key={unit.id}
                          label={unit.labelBn ?? unit.id}
                          meta={questionMeta(unit.count)}
                          logoUrl={logoById[institutionId] ?? null}
                          tone="info"
                          selected={unit.id === unitId}
                          onClick={() => selectUnit(unit.id)}
                        />
                      ))}
                    </>
                  )}
                </div>
              </HubSection>
            )}

            {(facetsQuery.isPending || years.length > 0) && (
              <HubSection title={t('questionBank.hub.years')}>
                <div className="space-y-2.5">
                  {facetsQuery.isPending ? (
                    [0, 1, 2].map((index) => (
                      <div
                        key={index}
                        className="h-[74px] animate-pulse rounded-[22px] border border-card-border bg-card-bg"
                      />
                    ))
                  ) : (
                    years.map((year) => (
                      <Link
                        key={year.id}
                        to={hubUniversityYearHref(institutionId, unitId, year.id)}
                        className="!no-underline [text-decoration-line:none!important] flex items-center gap-3 rounded-[22px] border border-card-border bg-card-bg px-3.5 py-3 transition-colors active:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-info/20 bg-info/10 text-info">
                          <CalendarDays className="h-[18px] w-[18px]" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-extrabold text-text-primary">
                            {localizeDigits(year.labelBn ?? year.id, language)}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-text-secondary">
                            <span className="inline-flex items-center gap-1 text-success">
                              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                              {questionMeta(year.count)}
                            </span>
                            {selectedUnit && (
                              <span className="inline-flex items-center gap-1">
                                {selectedUnit.labelBn ?? selectedUnit.id}
                              </span>
                            )}
                          </span>
                        </span>
                        <ChevronRight
                          className="h-4 w-4 shrink-0 text-text-secondary"
                          aria-hidden="true"
                        />
                      </Link>
                    ))
                  )}
                </div>
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