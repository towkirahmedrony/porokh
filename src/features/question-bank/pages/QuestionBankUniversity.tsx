import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, FileText, RefreshCw } from 'lucide-react';
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
  hubUnitQuestionsHref,
  hubUniversityUnitHref,
} from '../utils/questionBankHub';
import {
  DEFAULT_QUESTION_BANK_FILTERS,
  type QuestionBankFilterState,
} from '../types/questionBank';

/**
 * One university's admission bank, first step: its units.
 *
 * The screen holds one decision on purpose. A student picks an institution on
 * the hub, picks a unit here, then picks a paper on the unit's page, and only
 * then sees questions — the same four-step path the reference layout follows.
 * The year list that used to share this page now lives one level deeper, so
 * nothing on this screen competes with the units.
 *
 * The unit counts are the same facet RPC the filter sheet already reads, called
 * with the university fixed, which is why the number on a tile and the list
 * behind it cannot drift apart. When a university has no unit rows at all, the
 * page still offers its questions as one row instead of showing an empty grid.
 */
export default function QuestionBankUniversity() {
  const { institutionId = '' } = useParams<{ institutionId: string }>();
  const navigate = useNavigate();
  const { t, language } = useLanguage();

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
    }),
    [institutionId]
  );

  const facetsQuery = useQuery({
    queryKey: ['question-bank', 'facets', filters],
    queryFn: () => fetchQuestionBankFacets(filters),
    enabled: Boolean(institutionId),
    staleTime: 1000 * 60 * 2,
  });

  const units = facetsQuery.data?.admission_unit ?? [];
  const logoUrl = logoById[institutionId] ?? null;

  const questionMeta = (count: number) =>
    t('questionBank.hub.questionMeta', {
      count: localizeDigits(count, language),
    });

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
              logoUrl={logoUrl}
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
            {(facetsQuery.isPending || units.length > 0) && (
              <HubSection
                title={t('questionBank.hub.units')}
                meta={
                  facetsQuery.isPending
                    ? undefined
                    : localizeDigits(units.length, language)
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
                    units.map((unit) => (
                      <HubLogoTile
                        key={unit.id}
                        href={hubUniversityUnitHref(institutionId, unit.id)}
                        label={unit.labelBn ?? unit.id}
                        meta={questionMeta(unit.count)}
                        logoUrl={logoUrl}
                        tone="info"
                      />
                    ))
                  )}
                </div>
              </HubSection>
            )}

            {!facetsQuery.isPending && units.length === 0 && (
              <Link
                to={hubUnitQuestionsHref(institutionId, '')}
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
                    {questionMeta(university?.count ?? 0)}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
              </Link>
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
