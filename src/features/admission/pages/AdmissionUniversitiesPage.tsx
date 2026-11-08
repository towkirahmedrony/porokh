import React, { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { AdmissionBreadcrumb } from '../components/AdmissionBreadcrumb';
import { AdmissionState } from '../components/AdmissionState';
import AdmissionHubUniversityCard from '../components/AdmissionHubUniversityCard';
import { useAdmissionHubCatalog } from '../hooks/useAdmissionHub';

const normalizeSearch = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Admission → University.
 *
 * The catalog RPC returns every active university with its units and counts in
 * one payload, so the grid never issues a request per card. Search covers the
 * Bangla name, English name and the short code (DU, RU, ...).
 */
const AdmissionUniversitiesPage: React.FC = () => {
  const { t } = useLanguage();
  const catalogQuery = useAdmissionHubCatalog();
  const [search, setSearch] = useState('');

  const universities = useMemo(() => {
    const items = catalogQuery.data ?? [];
    const query = normalizeSearch(search);
    if (!query) return items;

    return items.filter((university) =>
      normalizeSearch(
        [
          university.nameBn,
          university.nameEn ?? '',
          university.shortName ?? '',
          university.location ?? '',
        ].join(' ')
      ).includes(query)
    );
  }, [catalogQuery.data, search]);

  return (
    <div className="mx-auto w-full max-w-5xl pb-8">
      <AdmissionBreadcrumb
        items={[
          { label: t('nav.home'), to: '/dashboard/home' },
          { label: t('admission.title') },
        ]}
      />

      <header className="mb-4">
        <h1 className="font-['Hind_Siliguri'] text-2xl font-bold leading-snug text-text-primary">
          {t('admission.universityListTitle')}
        </h1>
        <p className="mt-1 font-['Hind_Siliguri'] text-sm leading-6 text-text-secondary">
          {t('admission.universityListHint')}
        </p>

        <div className="relative mt-3">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
            aria-hidden="true"
          />
          <label htmlFor="admission-university-search" className="sr-only">
            {t('admission.searchLabel')}
          </label>
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
      </header>

      {catalogQuery.isError ? (
        <AdmissionState
          variant="error"
          title={t('admission.errorTitle')}
          message={t('admission.errorMessage')}
          actionLabel={t('admission.retry')}
          onAction={() => catalogQuery.refetch()}
        />
      ) : catalogQuery.isLoading ? (
        <div
          className="grid grid-cols-2 gap-3"
          role="status"
          aria-live="polite"
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton
              key={`admission-university-skeleton-${index}`}
              className="h-[140px] rounded-[20px] bg-surface-elevated"
            />
          ))}
        </div>
      ) : (catalogQuery.data?.length ?? 0) === 0 ? (
        <AdmissionState
          variant="missing-data"
          title={t('admission.noUniversitiesWithUnits')}
          message={t('admission.noUniversitiesWithUnitsHint')}
        />
      ) : universities.length === 0 ? (
        <AdmissionState
          variant="empty"
          title={t('admission.noSearchResults')}
          message={t('admission.noSearchResultsHint')}
          actionLabel={t('admission.clearSearch')}
          onAction={() => setSearch('')}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {universities.map((university) => (
            <AdmissionHubUniversityCard
              key={university.id}
              university={university}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AdmissionUniversitiesPage;
