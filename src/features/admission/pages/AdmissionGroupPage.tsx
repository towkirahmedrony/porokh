import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { useAdmissionCatalog } from '../hooks/useAdmissionCatalog';
import { getAdmissionGroup } from '../lib/admissionAdapter';
import {
  formatAdmissionCount,
  getAdmissionGroupDescription,
  getAdmissionGroupName,
} from '../lib/admissionLabels';
import { AdmissionState } from '../components/AdmissionState';
import { AdmissionSkeleton } from '../components/AdmissionSkeleton';
import { AdmissionBreadcrumb } from '../components/AdmissionBreadcrumb';
import { AdmissionExamTypeCard } from '../components/AdmissionExamTypeCard';
import type { AdmissionGroup } from '../types/admission';

const AdmissionGroupPage: React.FC = () => {
  const { groupSlug } = useParams<{ groupSlug: string }>();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { data: catalog, isLoading, isError, refetch } = useAdmissionCatalog();

  const group: AdmissionGroup | null = catalog
    ? getAdmissionGroup(catalog, groupSlug)
    : null;

  const backToAdmission = () => navigate('/admission');

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
        <AdmissionSkeleton cards={2} columns={2} />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="mx-auto w-full max-w-5xl pb-8">
        <AdmissionBreadcrumb
          items={[
            { label: t('admission.title'), to: '/admission' },
            { label: t('admission.notFoundTitle') },
          ]}
        />
        <AdmissionState
          variant="not-found"
          title={t('admission.notFoundTitle')}
          message={t('admission.groupNotFound')}
          actionLabel={t('admission.backToAdmission')}
          onAction={backToAdmission}
        />
      </div>
    );
  }

  const groupName = getAdmissionGroupName(group, t, language);
  const description = getAdmissionGroupDescription(group, t, language);
  const hasAnyExam = group.totalExams > 0;

  return (
    <div className="mx-auto w-full max-w-5xl pb-8">
      <AdmissionBreadcrumb
        items={[
          { label: t('nav.home'), to: '/dashboard/home' },
          { label: t('admission.title'), to: '/admission' },
          { label: groupName },
        ]}
      />

      <section className="rounded-3xl border border-card-border bg-card-bg px-5 py-6 shadow-sm sm:px-7">
        <button
          type="button"
          onClick={backToAdmission}
          className="mb-4 inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-text-secondary transition-colors hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('admission.backToAdmission')}
        </button>

        <h1 className="font-['Noto_Sans_Bengali'] text-2xl font-bold text-text-primary sm:text-3xl">
          {groupName}
        </h1>

        {description && (
          <p className="mt-2 max-w-2xl font-['Noto_Sans_Bengali'] text-sm leading-7 text-text-secondary sm:text-base">
            {description}
          </p>
        )}

        <p className="mt-3 text-sm font-semibold text-text-secondary">
          {t('admission.examTypeCount', {
            count: formatAdmissionCount(group.totalExams, language),
          })}
        </p>
      </section>

      <section className="mt-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AdmissionExamTypeCard
            examType="model-test"
            count={group.examCounts['model-test']}
            to={`/admission/${group.slug}/model-test`}
          />

          <AdmissionExamTypeCard
            examType="past-exams"
            count={group.examCounts['past-exams']}
            to={`/admission/${group.slug}/past-exams`}
          />
        </div>

        {!hasAnyExam && (
          <div className="mt-5">
            <AdmissionState
              variant="missing-data"
              title={t('admission.dataMissingTitle')}
              message={t('admission.dataMissingMessage')}
            />
          </div>
        )}
      </section>
    </div>
  );
};

export default AdmissionGroupPage;
