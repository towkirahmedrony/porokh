import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { useAdmissionCatalog } from '../hooks/useAdmissionCatalog';
import {
  filterAdmissionExams,
  getAdmissionGroup,
  getAdmissionUnitsForSelection,
  getAdmissionUniversity,
  parseAdmissionExamType,
} from '../lib/admissionAdapter';
import {
  formatAdmissionCount,
  getAdmissionExamTypeLabel,
  getAdmissionGroupName,
} from '../lib/admissionLabels';
import { AdmissionBreadcrumb } from '../components/AdmissionBreadcrumb';
import { AdmissionState } from '../components/AdmissionState';
import { AdmissionSkeleton } from '../components/AdmissionSkeleton';
import { AdmissionUnitSelector } from '../components/AdmissionUnitSelector';

const AdmissionUniversityPage: React.FC = () => {
  const { groupSlug, examType: examTypeParam, universitySlug } = useParams<{
    groupSlug: string;
    examType: string;
    universitySlug: string;
  }>();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { data: catalog, isLoading, isError, refetch } = useAdmissionCatalog();

  const examType = parseAdmissionExamType(examTypeParam);
  const group = catalog ? getAdmissionGroup(catalog, groupSlug) : null;
  const university = catalog
    ? getAdmissionUniversity(catalog, universitySlug)
    : null;

  const exams =
    catalog && group && university && examType
      ? filterAdmissionExams(catalog, {
          groupSlug: group.slug,
          examType,
          universityId: university.id,
        })
      : [];

  const units =
    catalog && group && university && examType
      ? getAdmissionUnitsForSelection(catalog, {
          groupSlug: group.slug,
          examType,
          universityId: university.id,
        })
      : [];

  const groupName = group ? getAdmissionGroupName(group, t, language) : '';
  const examTypeLabel = examType
    ? getAdmissionExamTypeLabel(examType, t)
    : '';

  const universityName = university
    ? language === 'en'
      ? university.nameEn || university.nameBn
      : university.nameBn || university.nameEn || university.slug
    : '';
  const initial = universityName.trim().charAt(0).toUpperCase() || 'U';

  const breadcrumbItems = [
    { label: t('nav.home'), to: '/dashboard/home' },
    { label: t('admission.title'), to: '/admission' },
    ...(group ? [{ label: groupName, to: `/admission/${group.slug}` }] : []),
    ...(group && examType
      ? [
          {
            label: examTypeLabel,
            to: `/admission/${group.slug}/${examType}`,
          },
        ]
      : []),
    { label: universityName || t('admission.notFoundTitle') },
  ];

  const examListPath = (unitSlug: string | null) => {
    if (!group || !examType || !university) return '/admission';
    const query = unitSlug ? `?unit=${encodeURIComponent(unitSlug)}` : '';
    return `/admission/${group.slug}/${examType}/${university.slug}/exams${query}`;
  };

  if (isError) {
    return (
      <div className="mx-auto w-full max-w-5xl pb-8">
        <AdmissionState
          variant="error"
          title={t('admission.errorTitle')}
          message={t('admission.errorMessage')}
          actionLabel={t('admission.retry')}
          onAction={() => refetch()}
        />
      </div>
    );
  }

  if (isLoading || !catalog) {
    return (
      <div className="mx-auto w-full max-w-5xl pb-8">
        <AdmissionSkeleton cards={3} columns={3} />
      </div>
    );
  }

  if (!group || !examType || !university) {
    return (
      <div className="mx-auto w-full max-w-5xl pb-8">
        <AdmissionBreadcrumb items={breadcrumbItems} />
        <AdmissionState
          variant="not-found"
          title={t('admission.notFoundTitle')}
          message={
            !group
              ? t('admission.groupNotFound')
              : !examType
                ? t('admission.examTypeNotFound')
                : t('admission.universityNotFound')
          }
          actionLabel={t('admission.backToAdmission')}
          onAction={() => navigate('/admission')}
        />
      </div>
    );
  }

  if (exams.length === 0) {
    return (
      <div className="mx-auto w-full max-w-5xl pb-8">
        <AdmissionBreadcrumb items={breadcrumbItems} />
        <AdmissionState
          variant="empty"
          title={t('admission.noUniversities')}
          message={t('admission.noUniversitiesHint')}
          actionLabel={t('admission.back')}
          onAction={() => navigate(`/admission/${group.slug}/${examType}`)}
        />
      </div>
    );
  }

  const examCountLabel = formatAdmissionCount(exams.length, language);
  const unitCountLabel = formatAdmissionCount(units.length, language);

  return (
    <div className="mx-auto w-full max-w-5xl pb-8">
      <AdmissionBreadcrumb items={breadcrumbItems} />

      <section className="rounded-3xl border border-card-border bg-card-bg p-5 shadow-sm sm:p-7">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border-color bg-surface font-['Noto_Sans_Bengali'] text-xl font-bold text-primary">
            {initial}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="font-['Noto_Sans_Bengali'] text-2xl font-bold leading-snug text-text-primary sm:text-3xl">
              {universityName}
            </h1>

            {university.shortName && (
              <p className="mt-1 text-sm font-semibold text-text-secondary">
                {university.shortName}
              </p>
            )}

            {university.location && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-text-secondary">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{university.location}</span>
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-badge-bg px-3 py-1 text-xs font-semibold text-badge-text">
                {t('admission.examsCount', { count: examCountLabel })}
              </span>

              {units.length > 0 && (
                <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-text-secondary">
                  {t('admission.unitsCount', { count: unitCountLabel })}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {units.length > 0 ? (
        <section className="mt-6">
          <h2 className="font-['Noto_Sans_Bengali'] text-xl font-bold text-text-primary">
            {t('admission.unitsTitle')}
          </h2>
          <p className="mt-1 font-['Noto_Sans_Bengali'] text-sm text-text-secondary">
            {t('admission.unitsHint')}
          </p>

          <div className="mt-4">
            <AdmissionUnitSelector
              units={units}
              selectedUnitSlug={null}
              onSelect={(unitSlug) => navigate(examListPath(unitSlug))}
            />
          </div>

          <button
            type="button"
            onClick={() => navigate(examListPath(null))}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {t('admission.continueToExams')}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </section>
      ) : (
        <section className="mt-6 rounded-2xl border border-card-border bg-card-bg p-5 shadow-sm">
          <h2 className="font-['Noto_Sans_Bengali'] text-lg font-bold text-text-primary">
            {t('admission.universityExamsTitle')}
          </h2>
          <p className="mt-1 font-['Noto_Sans_Bengali'] text-sm text-text-secondary">
            {t('admission.noUnits')}
          </p>

          <button
            type="button"
            onClick={() => navigate(examListPath(null))}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {t('admission.viewExams')}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </section>
      )}
    </div>
  );
};

export default AdmissionUniversityPage;
