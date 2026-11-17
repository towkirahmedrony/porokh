import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Landmark, ListChecks } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { useAdmissionCatalog } from '../hooks/useAdmissionCatalog';
import { AdmissionBreadcrumb } from '../components/AdmissionBreadcrumb';
import { AdmissionGroupCard } from '../components/AdmissionGroupCard';
import { AdmissionUniversityCard } from '../components/AdmissionUniversityCard';
import { AdmissionState } from '../components/AdmissionState';
import { AdmissionSkeleton } from '../components/AdmissionSkeleton';
import { formatAdmissionCount } from '../lib/admissionLabels';
import type { AdmissionUniversity } from '../types/admission';

interface FeaturedUniversity {
  university: AdmissionUniversity;
  href: string;
  examCount: number;
  unitCount: number;
}

const AdmissionLandingPage: React.FC = () => {
  const { t, language } = useLanguage();
  const {
    data: catalog,
    isLoading,
    isError,
    refetch,
  } = useAdmissionCatalog();

  const featuredUniversities = useMemo<FeaturedUniversity[]>(() => {
    if (!catalog) return [];

    return catalog.universities
      .filter((university) => university.totalExams > 0)
      .map((university) => {
        const exams = catalog.exams
          .filter(
            (exam) =>
              exam.universityId === university.id &&
              exam.groupSlug !== null &&
              exam.examType !== null
          )
          .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

        const primary = exams[0];
        if (!primary || !primary.groupSlug || !primary.examType) return null;

        const unitCount = new Set(
          exams
            .filter(
              (exam) =>
                exam.groupSlug === primary.groupSlug &&
                exam.examType === primary.examType &&
                exam.unit !== null
            )
            .map((exam) => exam.unit?.slug)
        ).size;

        return {
          university,
          href: `/admission/${primary.groupSlug}/${primary.examType}/${university.slug}`,
          examCount: exams.length,
          unitCount,
        };
      })
      .filter((value): value is FeaturedUniversity => value !== null)
      .sort((a, b) => b.examCount - a.examCount)
      .slice(0, 4);
  }, [catalog]);

  const universityCount = catalog
    ? catalog.universities.filter((university) => university.totalExams > 0).length
    : 0;
  const examCount = catalog?.exams.length ?? 0;
  const hasAdmissionContent = examCount > 0;

  return (
    <div className="mx-auto w-full max-w-6xl pb-8">
      <AdmissionBreadcrumb
        items={[
          { label: t('nav.home'), to: '/dashboard/home' },
          { label: t('admission.title') },
        ]}
      />

      <section className="relative overflow-hidden rounded-3xl border border-card-border bg-card-bg px-5 py-7 shadow-sm sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative z-10 max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-badge-bg px-3 py-1.5 text-xs font-bold text-badge-text">
            <GraduationCap className="h-4 w-4" aria-hidden="true" />
            {t('admission.eyebrow')}
          </div>

          <h1 className="font-['Noto_Sans_Bengali'] text-3xl font-bold leading-tight text-text-primary sm:text-4xl">
            {t('admission.title')}
          </h1>

          <p className="mt-3 font-['Noto_Sans_Bengali'] text-sm leading-7 text-text-secondary sm:text-base">
            {t('admission.intro')}
          </p>

          <Link
            to="/dashboard/home"
            className="!no-underline [text-decoration-line:none!important] mt-5 inline-flex items-center gap-2 rounded-xl border border-border-color bg-surface px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {t('admission.backToHome')}
          </Link>
        </div>

        {!isLoading && !isError && hasAdmissionContent && (
          <div className="relative z-10 mt-6 grid grid-cols-2 gap-2.5 sm:max-w-md">
            <div className="rounded-2xl border border-card-border bg-surface/80 px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
                <Landmark className="h-4 w-4" aria-hidden="true" />
                {t('admission.universityStat')}
              </div>
              <p className="mt-1 font-['Noto_Sans_Bengali'] text-2xl font-bold text-text-primary">
                {formatAdmissionCount(universityCount, language)}
              </p>
            </div>

            <div className="rounded-2xl border border-card-border bg-surface/80 px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
                <ListChecks className="h-4 w-4" aria-hidden="true" />
                {t('admission.totalExams')}
              </div>
              <p className="mt-1 font-['Noto_Sans_Bengali'] text-2xl font-bold text-text-primary">
                {formatAdmissionCount(examCount, language)}
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="mt-5 rounded-3xl bg-card-bg p-5 sm:p-6">
        <h2 className="font-['Noto_Sans_Bengali'] text-lg font-bold text-text-primary sm:text-xl">
          {t('admission.modelTestCtaTitle')}
        </h2>
        <p className="mt-1 font-['Noto_Sans_Bengali'] text-sm text-text-secondary">
          {t('admission.modelTestCtaHint')}
        </p>

        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {[
            { to: '/exams/model?category=medical', labelKey: 'admission.modelTestMedical' as const },
            { to: '/exams/model?category=engineering', labelKey: 'admission.modelTestEngineering' as const },
            { to: '/admission', labelKey: 'admission.modelTestUniversity' as const },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="!no-underline [text-decoration-line:none!important] flex items-center justify-between rounded-2xl bg-surface px-4 py-3.5 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {t(item.labelKey)}
              <ListChecks className="h-4 w-4 text-primary" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      {isError ? (
        <div className="mt-6">
          <AdmissionState
            variant="error"
            title={t('admission.errorTitle')}
            message={t('admission.errorMessage')}
            actionLabel={t('admission.retry')}
            onAction={() => refetch()}
          />
        </div>
      ) : isLoading || !catalog ? (
        <div className="mt-6">
          <AdmissionSkeleton cards={3} columns={3} />
        </div>
      ) : (
        <>
          <section className="mt-7">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <h2 className="font-['Noto_Sans_Bengali'] text-xl font-bold text-text-primary sm:text-2xl">
                  {t('admission.browseGroups')}
                </h2>
                <p className="mt-1 font-['Noto_Sans_Bengali'] text-sm text-text-secondary">
                  {t('admission.browseGroupsHint')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {catalog.groups.map((group) => (
                <AdmissionGroupCard
                  key={group.slug}
                  group={group}
                  to={`/admission/${group.slug}`}
                />
              ))}
            </div>
          </section>

          {featuredUniversities.length > 0 && (
            <section className="mt-7">
              <div className="mb-3">
                <h2 className="font-['Noto_Sans_Bengali'] text-xl font-bold text-text-primary sm:text-2xl">
                  {t('admission.featuredUniversities')}
                </h2>
                <p className="mt-1 font-['Noto_Sans_Bengali'] text-sm text-text-secondary">
                  {t('admission.featuredHint')}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {featuredUniversities.map(
                  ({ university, href, examCount: count, unitCount }) => (
                    <AdmissionUniversityCard
                      key={university.id}
                      university={university}
                      examCount={count}
                      unitCount={unitCount}
                      to={href}
                    />
                  )
                )}
              </div>
            </section>
          )}

          {!hasAdmissionContent && (
            <div className="mt-7">
              <AdmissionState
                variant="missing-data"
                title={t('admission.dataMissingTitle')}
                message={t('admission.dataMissingMessage')}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdmissionLandingPage;
