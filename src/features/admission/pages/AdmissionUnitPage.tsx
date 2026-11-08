import React from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { AdmissionBreadcrumb } from '../components/AdmissionBreadcrumb';
import { AdmissionState } from '../components/AdmissionState';
import AdmissionBankPanel from '../components/AdmissionBankPanel';
import AdmissionHubTabs from '../components/AdmissionHubTabs';
import AdmissionPaperRow from '../components/AdmissionPaperRow';
import UniversityLogo from '../components/UniversityLogo';
import { useAdmissionUnitHub } from '../hooks/useAdmissionHub';
import type { AdmissionHubTab } from '../types/admissionHub';

const isHubTab = (value: string | null): value is AdmissionHubTab =>
  value === 'papers' || value === 'models' || value === 'bank';

/**
 * Admission → University → Unit hub.
 *
 * The tab lives in the URL (`?tab=papers|models|bank`) so a refresh or a shared
 * link opens the same section. Papers and model tests start through the
 * existing server-issued attempt flow; the bank is view-only practice.
 */
const AdmissionUnitPage: React.FC = () => {
  const { institutionSlug, unitCode } = useParams<{
    institutionSlug: string;
    unitCode: string;
  }>();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const unitQuery = useAdmissionUnitHub(institutionSlug, unitCode);

  const content = unitQuery.data ?? null;
  const requestedTab = searchParams.get('tab');
  const activeTab: AdmissionHubTab = isHubTab(requestedTab)
    ? requestedTab
    : 'papers';

  const selectTab = (tab: AdmissionHubTab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  const unitName = content
    ? language === 'en'
      ? content.unit.nameEn || content.unit.nameBn
      : content.unit.nameBn || content.unit.nameEn || content.unit.code
    : '';

  const universityName = content
    ? language === 'en'
      ? content.university.nameEn || content.university.nameBn
      : content.university.nameBn || content.university.nameEn || ''
    : '';

  const breadcrumbItems = [
    { label: t('nav.home'), to: '/dashboard/home' },
    { label: t('admission.title'), to: '/admission' },
    {
      label: universityName || t('admission.universityNotFound'),
      to: content
        ? `/admission/${encodeURIComponent(content.university.slug)}`
        : '/admission',
    },
    { label: unitName || t('admission.unitNotFound') },
  ];

  if (unitQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-5xl pb-8">
        <AdmissionState
          variant="error"
          title={t('admission.errorTitle')}
          message={t('admission.errorMessage')}
          actionLabel={t('admission.retry')}
          onAction={() => unitQuery.refetch()}
        />
      </div>
    );
  }

  if (unitQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-3 pb-8">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-24 w-full rounded-[20px] bg-surface-elevated" />
        <Skeleton className="h-12 w-full rounded-2xl bg-surface-elevated" />
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton
            key={`admission-hub-skeleton-${index}`}
            className="h-28 w-full rounded-2xl bg-surface-elevated"
          />
        ))}
      </div>
    );
  }

  if (!content) {
    return (
      <div className="mx-auto w-full max-w-5xl pb-8">
        <AdmissionBreadcrumb items={breadcrumbItems} />
        <AdmissionState
          variant="not-found"
          title={t('admission.notFoundTitle')}
          message={t('admission.unitNotFound')}
          actionLabel={t('admission.backToAdmission')}
          onAction={() => navigate('/admission')}
        />
      </div>
    );
  }

  const startExam = (examId: string) => {
    navigate(`/admission/exam/${encodeURIComponent(examId)}`);
  };

  const summary = [
    content.pastPapers.length > 0
      ? t('admission.hub.paperCount', { count: content.pastPapers.length })
      : null,
    content.modelTests.length > 0
      ? t('admission.hub.modelCount', { count: content.modelTests.length })
      : null,
    content.bank.total > 0
      ? t('admission.hub.questionsCount', { count: content.bank.total })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="mx-auto w-full max-w-5xl pb-10">
      <AdmissionBreadcrumb items={breadcrumbItems} />

      <header className="mb-4 rounded-[20px] border border-card-border bg-card-bg p-4">
        <Link
          to={`/admission/${encodeURIComponent(content.university.slug)}`}
          className="!no-underline [text-decoration-line:none!important] mb-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg text-sm font-medium text-text-secondary transition-colors hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('admission.back')}
        </Link>

        <div className="flex items-start gap-3">
          <UniversityLogo
            logoUrl={content.university.logoUrl}
            name={universityName}
            shortName={content.university.shortName}
            className="h-12 w-12"
          />

          <div className="min-w-0 flex-1">
            <p className="truncate font-['Hind_Siliguri'] text-xs font-semibold text-text-secondary">
              {universityName}
            </p>

            <div className="mt-0.5 flex items-center gap-2">
              <h1 className="min-w-0 font-['Hind_Siliguri'] text-xl font-bold leading-snug text-text-primary sm:text-2xl">
                {unitName}
              </h1>
              <span className="shrink-0 rounded-md bg-badge-bg px-2 py-0.5 text-[11px] font-bold uppercase text-badge-text">
                {content.unit.code}
              </span>
            </div>

            {content.unit.description && (
              <p className="mt-1 line-clamp-2 font-['Hind_Siliguri'] text-xs leading-5 text-text-secondary">
                {content.unit.description}
              </p>
            )}

            {summary && (
              <p className="mt-1.5 text-[11px] font-semibold text-text-secondary">
                {summary}
              </p>
            )}
          </div>
        </div>
      </header>

      <AdmissionHubTabs active={activeTab} onChange={selectTab} />

      <div className="mt-3">
        {activeTab === 'papers' && (
          <div
            role="tabpanel"
            id="admission-hub-panel-papers"
            aria-labelledby="admission-hub-tab-papers"
            className="space-y-2.5"
          >
            {content.pastPapers.length === 0 ? (
              <AdmissionState
                variant="empty"
                title={t('admission.hub.emptyPapers')}
                message={t('admission.hub.emptyPapersHint')}
              />
            ) : (
              content.pastPapers.map((paper) => (
                <AdmissionPaperRow
                  key={paper.id}
                  paper={paper}
                  onStart={startExam}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'models' && (
          <div
            role="tabpanel"
            id="admission-hub-panel-models"
            aria-labelledby="admission-hub-tab-models"
            className="space-y-2.5"
          >
            {content.modelTests.length === 0 ? (
              <AdmissionState
                variant="empty"
                title={t('admission.hub.emptyModels')}
                message={t('admission.hub.emptyModelsHint')}
              />
            ) : (
              content.modelTests.map((paper) => (
                <AdmissionPaperRow
                  key={paper.id}
                  paper={paper}
                  onStart={startExam}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'bank' && (
          <AdmissionBankPanel unitId={content.unit.id} facets={content.bank} />
        )}
      </div>
    </div>
  );
};

export default AdmissionUnitPage;
