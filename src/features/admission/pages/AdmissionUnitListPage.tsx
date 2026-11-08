import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { AdmissionBreadcrumb } from '../components/AdmissionBreadcrumb';
import { AdmissionState } from '../components/AdmissionState';
import AdmissionUnitCard from '../components/AdmissionUnitCard';
import UniversityLogo from '../components/UniversityLogo';
import { useAdmissionHubCatalog } from '../hooks/useAdmissionHub';

/** Admission → University → Unit: the units offered by one university. */
const AdmissionUnitListPage: React.FC = () => {
  const { institutionSlug } = useParams<{ institutionSlug: string }>();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const catalogQuery = useAdmissionHubCatalog();

  const university =
    catalogQuery.data?.find((entry) => entry.slug === institutionSlug) ?? null;

  const universityName = university
    ? language === 'en'
      ? university.nameEn || university.nameBn
      : university.nameBn || university.nameEn || ''
    : '';

  const breadcrumbItems = [
    { label: t('nav.home'), to: '/dashboard/home' },
    { label: t('admission.title'), to: '/admission' },
    { label: universityName || t('admission.notFoundTitle') },
  ];

  if (catalogQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-5xl pb-8">
        <AdmissionState
          variant="error"
          title={t('admission.errorTitle')}
          message={t('admission.errorMessage')}
          actionLabel={t('admission.retry')}
          onAction={() => catalogQuery.refetch()}
        />
      </div>
    );
  }

  if (catalogQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl pb-8">
        <div className="grid grid-cols-2 gap-3" role="status" aria-live="polite">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton
              key={`admission-unit-skeleton-${index}`}
              className="h-[132px] rounded-[20px] bg-surface-elevated"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!university) {
    return (
      <div className="mx-auto w-full max-w-5xl pb-8">
        <AdmissionBreadcrumb items={breadcrumbItems} />
        <AdmissionState
          variant="not-found"
          title={t('admission.notFoundTitle')}
          message={t('admission.universityNotFound')}
          actionLabel={t('admission.backToAdmission')}
          onAction={() => navigate('/admission')}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl pb-8">
      <AdmissionBreadcrumb items={breadcrumbItems} />

      <header className="mb-4">
        <Link
          to="/admission"
          className="mb-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg text-sm font-medium text-text-secondary transition-colors hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('admission.backToAdmission')}
        </Link>

        <div className="flex items-center gap-3">
          <UniversityLogo
            logoUrl={university.logoUrl}
            name={universityName}
            shortName={university.shortName}
            className="h-12 w-12"
          />
          <div className="min-w-0">
            <h1 className="font-['Hind_Siliguri'] text-xl font-bold leading-snug text-text-primary sm:text-2xl">
              {universityName}
            </h1>
            <p className="mt-0.5 font-['Hind_Siliguri'] text-sm text-text-secondary">
              {t('admission.unitListHint')}
            </p>
          </div>
        </div>
      </header>

      {university.units.length === 0 ? (
        <AdmissionState
          variant="empty"
          title={t('admission.noUnits')}
          message={t('admission.noUniversitiesWithUnitsHint')}
          actionLabel={t('admission.backToAdmission')}
          onAction={() => navigate('/admission')}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {university.units.map((unit) => (
            <AdmissionUnitCard
              key={unit.id}
              unit={unit}
              institutionSlug={university.slug}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AdmissionUnitListPage;
