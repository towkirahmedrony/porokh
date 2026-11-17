import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { useAdmissionCatalog } from '../hooks/useAdmissionCatalog';
import {
  getAdmissionGroup,
  getAdmissionUniversities,
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
import { AdmissionUniversityCard } from '../components/AdmissionUniversityCard';
import type { AdmissionExamType } from '../types/admission';

const normalizeSearch = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();

const AdmissionUniversityListPage: React.FC = () => {
  const { groupSlug, examType: examTypeParam } = useParams<{
    groupSlug: string;
    examType: string;
  }>();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { data: catalog, isLoading, isError, refetch } = useAdmissionCatalog();
  const [search, setSearch] = useState('');

  const examType: AdmissionExamType | null =
    parseAdmissionExamType(examTypeParam);

  useEffect(() => {
    setSearch('');
  }, [groupSlug, examTypeParam]);

  const group = catalog ? getAdmissionGroup(catalog, groupSlug) : null;

  const universities = useMemo(() => {
    if (!catalog || !group || !examType) return [];
    return getAdmissionUniversities(catalog, {
      groupSlug: group.slug,
      examType,
    });
  }, [catalog, group, examType]);

  const unitCounts = useMemo(() => {
    const counts = new Map<string, Set<string>>();
    if (!catalog || !group || !examType) return counts;

    for (const exam of catalog.exams) {
      if (
        exam.groupSlug !== group.slug ||
        exam.examType !== examType ||
        !exam.universityId ||
        !exam.unit
      ) {
        continue;
      }

      const units = counts.get(exam.universityId) ?? new Set<string>();
      units.add(exam.unit.slug);
      counts.set(exam.universityId, units);
    }

    return counts;
  }, [catalog, group, examType]);

  const filtered = useMemo(() => {
    const query = normalizeSearch(search);
    if (!query) return universities;

    return universities.filter((university) => {
      const haystack = normalizeSearch(
        [
          university.nameBn,
          university.nameEn ?? '',
          university.shortName ?? '',
          university.slug,
        ].join(' ')
      );

      return haystack.includes(query);
    });
  }, [universities, search]);

  const groupName = group ? getAdmissionGroupName(group, t, language) : '';
  const examTypeLabel = examType
    ? getAdmissionExamTypeLabel(examType, t)
    : '';

  const breadcrumbItems = [
    { label: t('nav.home'), to: '/dashboard/home' },
    { label: t('admission.title'), to: '/admission' },
    ...(group
      ? [{ label: groupName, to: `/admission/${group.slug}` }]
      : []),
    { label: examTypeLabel || t('admission.notFoundTitle') },
  ];

  if (isError) {
    return (
      <div className="mx-auto w-full max-w-6xl pb-8">
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
      <div className="mx-auto w-full max-w-6xl pb-8">
        <AdmissionSkeleton cards={6} columns={3} />
      </div>
    );
  }

  if (!group || !examType) {
    return (
      <div className="mx-auto w-full max-w-6xl pb-8">
        <AdmissionBreadcrumb items={breadcrumbItems} />
        <AdmissionState
          variant="not-found"
          title={t('admission.notFoundTitle')}
          message={
            !group ? t('admission.groupNotFound') : t('admission.examTypeNotFound')
          }
          actionLabel={t('admission.backToAdmission')}
          onAction={() => navigate('/admission')}
        />
      </div>
    );
  }

  const resultCount = formatAdmissionCount(filtered.length, language);

  return (
    <div className="mx-auto w-full max-w-6xl pb-8">
      <AdmissionBreadcrumb items={breadcrumbItems} />

      <header className="rounded-3xl border border-card-border bg-card-bg px-5 py-6 shadow-sm sm:px-7">
        <h1 className="font-['Noto_Sans_Bengali'] text-2xl font-bold text-text-primary sm:text-3xl">
          {t('admission.universityTitle')}
        </h1>

        <p className="mt-1 font-['Noto_Sans_Bengali'] text-sm text-text-secondary sm:text-base">
          {t('admission.universitySubtitle', {
            group: groupName,
            examType: examTypeLabel,
          })}
        </p>

        <div className="mt-4">
          <label
            htmlFor="admission-university-search"
            className="mb-1.5 block font-['Noto_Sans_Bengali'] text-sm font-semibold text-text-primary"
          >
            {t('admission.searchLabel')}
          </label>

          <div className="relative max-w-xl">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
              aria-hidden="true"
            />

            <input
              id="admission-university-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('admission.searchPlaceholder')}
              className="w-full rounded-xl border border-input-border bg-input-bg py-2.5 pl-9 pr-10 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-focus-ring"
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label={t('admission.clearSearch')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-surface hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <p className="mt-3 text-xs font-semibold text-text-secondary">
          {t('admission.searchResults', { count: resultCount })}
        </p>
      </header>

      {universities.length === 0 ? (
        <div className="mt-6">
          <AdmissionState
            variant={
              catalog.diagnostics.missingUniversity > 0
                ? 'missing-data'
                : 'empty'
            }
            title={
              catalog.diagnostics.missingUniversity > 0
                ? t('admission.missingUniversityData')
                : t('admission.noUniversities')
            }
            message={
              catalog.diagnostics.missingUniversity > 0
                ? t('admission.dataMissingMessage')
                : t('admission.noUniversitiesHint')
            }
            actionLabel={t('admission.backToAdmission')}
            onAction={() => navigate('/admission')}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-6">
          <AdmissionState
            variant="empty"
            title={t('admission.noSearchResults')}
            message={t('admission.noSearchResultsHint')}
            actionLabel={t('admission.clearSearch')}
            onAction={() => setSearch('')}
          />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((university) => (
            <AdmissionUniversityCard
              key={university.id}
              university={university}
              examCount={university.totalExams}
              unitCount={unitCounts.get(university.id)?.size ?? 0}
              to={`/admission/${group.slug}/${examType}/${university.slug}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AdmissionUniversityListPage;
