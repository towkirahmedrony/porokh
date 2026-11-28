import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronLeft, ChevronRight, FileText, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import UniversityLogo from '@/features/admission/components/UniversityLogo';
import { HubSection } from '../components/hub/HubSection';
import { useQuestionBankHub } from '../hooks/useQuestionBankHub';
import { useUniversityLogoMap } from '../hooks/useUniversityLogoMap';
import { fetchQuestionBankFacets } from '../services/questionBankLevelService';
import { fetchUnitPapers } from '../services/questionBankPaperService';
import {
  hubUniversityPageHref,
  hubUniversityYearHref,
  hubUnitQuestionsHref,
} from '../utils/questionBankHub';
import { paperLabel } from '../utils/questionBankPaper';
import {
  DEFAULT_QUESTION_BANK_FILTERS,
  type QuestionBankFilterState,
} from '../types/questionBank';

/**
 * One unit of one university, third step of the drill-down: its exam papers.
 *
 * A year is not a paper. "2025-26" was sat in four shifts, and each shift (or
 * set) is the paper a student actually wants, so the list is one row per paper
 * with its own question count. Tapping a row opens exactly that paper's
 * questions, which is the last page of the path. The all-questions row at the
 * top is the same unit without a paper for a student who wants to revise
 * everything.
 *
 * The unit's own label comes from the facets response: the unit facet is
 * counted with its own filter dropped, so it still lists every unit of this
 * university and the current one can be named without a second request.
 */
export default function QuestionBankUnit() {
  const { institutionId = '', unitId = '' } = useParams<{
    institutionId: string;
    unitId: string;
  }>();
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
      admissionUnitId: unitId,
    }),
    [institutionId, unitId]
  );

  const facetsQuery = useQuery({
    queryKey: ['question-bank', 'facets', filters],
    queryFn: () => fetchQuestionBankFacets(filters),
    enabled: Boolean(institutionId && unitId),
    staleTime: 1000 * 60 * 2,
  });

  const papersQuery = useQuery({
    queryKey: ['question-bank', 'papers', filters],
    queryFn: () => fetchUnitPapers(filters),
    enabled: Boolean(institutionId && unitId),
    staleTime: 1000 * 60 * 2,
  });

  const facets = facetsQuery.data;
  const unit = facets?.admission_unit.find((row) => row.id === unitId) ?? null;
  const papers = papersQuery.data ?? [];
  const logoUrl = logoById[institutionId] ?? null;

  const questionMeta = (count: number) =>
    t('questionBank.hub.questionMeta', {
      count: localizeDigits(count, language),
    });

  const backHref = hubUniversityPageHref(institutionId);

  return (
    <div className="min-h-full bg-app pb-24">
      <div className="mx-auto w-full max-w-3xl pt-1">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigate(backHref)}
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
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] font-extrabold text-text-primary">
              {unit?.labelBn ?? t('questionBank.hub.units')}
            </h1>
            {university && (
              <p className="truncate text-[11px] font-semibold text-text-secondary">
                {university.labelBn}
              </p>
            )}
          </div>
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
            <Link
              to={hubUnitQuestionsHref(institutionId, unitId)}
              className="!no-underline [text-decoration-line:none!important] flex items-center gap-3 rounded-[22px] border border-primary/20 bg-primary/[0.08] px-3.5 py-3.5 transition-colors active:bg-primary/[0.12] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-[0_2px_10px_rgba(15,23,42,0.10)]">
                <FileText className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-extrabold text-text-primary">
                  {t('questionBank.hub.allQuestions')}
                </span>
                {unit && (
                  <span className="mt-0.5 block text-[11px] font-semibold text-text-secondary">
                    {questionMeta(unit.count)}
                  </span>
                )}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
            </Link>

            {(papersQuery.isPending || papers.length > 0) && (
              <HubSection title={t('admission.examType.pastExams')}>
                <div className="space-y-2.5">
                  {papersQuery.isPending ? (
                    [0, 1, 2, 3].map((index) => (
                      <div
                        key={index}
                        className="h-[74px] animate-pulse rounded-[22px] border border-card-border bg-card-bg"
                      />
                    ))
                  ) : (
                    papers.map((paper) => (
                      <Link
                        key={paper.key}
                        to={hubUniversityYearHref(institutionId, unitId, paper.key)}
                        className="!no-underline [text-decoration-line:none!important] flex items-center gap-3 rounded-[22px] border border-card-border bg-card-bg px-3.5 py-3.5 transition-colors active:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-info/20 bg-info/10 text-info">
                          <CalendarDays className="h-[18px] w-[18px]" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-extrabold text-text-primary">
                            {paperLabel(paper, language)}
                          </span>
                          <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-success">
                            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                            {questionMeta(paper.count)}
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

            {!papersQuery.isPending && papers.length === 0 && !papersQuery.isError && (
              <div className="rounded-2xl border border-border-color bg-card-bg px-4 py-8 text-center">
                <p className="text-[13px] font-semibold text-text-primary">
                  {t('questionBank.hub.emptyTitle')}
                </p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-text-secondary">
                  {t('questionBank.hub.emptyBody')}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
