import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { useOfflineExam } from '@/features/exam/offline/useOfflineExam';
import { useAdmissionCatalog } from '../hooks/useAdmissionCatalog';
import {
  filterAdmissionExams,
  getAdmissionGroup,
  getAdmissionUnitsForSelection,
  getAdmissionUniversity,
  parseAdmissionExamType,
  sortAdmissionExams,
} from '../lib/admissionAdapter';
import {
  formatAdmissionCount,
  getAdmissionExamTypeLabel,
  getAdmissionGroupName,
} from '../lib/admissionLabels';
import { AdmissionBreadcrumb } from '../components/AdmissionBreadcrumb';
import { AdmissionExamCard } from '../components/AdmissionExamCard';
import { AdmissionSkeleton } from '../components/AdmissionSkeleton';
import { AdmissionState } from '../components/AdmissionState';
import { AdmissionUnitSelector } from '../components/AdmissionUnitSelector';

const AdmissionExamListPage: React.FC = () => {
  const {
    groupSlug,
    examType: examTypeParam,
    universitySlug,
  } = useParams<{
    groupSlug: string;
    examType: string;
    universitySlug: string;
  }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, language } = useLanguage();
  const offline = useOfflineExam();
  const { data: catalog, isLoading, isError, refetch } = useAdmissionCatalog();
  const [preparingId, setPreparingId] = useState<string | null>(null);

  const examType = parseAdmissionExamType(examTypeParam);
  const group = catalog ? getAdmissionGroup(catalog, groupSlug) : null;
  const university = catalog
    ? getAdmissionUniversity(catalog, universitySlug)
    : null;

  const unitSlug = searchParams.get('unit');

  const units = useMemo(() => {
    if (!catalog || !group || !examType || !university) return [];
    return getAdmissionUnitsForSelection(catalog, {
      groupSlug: group.slug,
      examType,
      universityId: university.id,
    });
  }, [catalog, group, examType, university]);

  const selectedUnit = unitSlug
    ? units.find((unit) => unit.slug === unitSlug) ?? null
    : null;

  const exams = useMemo(() => {
    if (!catalog || !group || !examType || !university) return [];
    const filtered = filterAdmissionExams(catalog, {
      groupSlug: group.slug,
      examType,
      universityId: university.id,
      unitSlug: selectedUnit?.slug ?? null,
    });
    return sortAdmissionExams(filtered, examType);
  }, [catalog, group, examType, university, selectedUnit]);

  const groupName = group ? getAdmissionGroupName(group, t, language) : '';
  const examTypeLabel = examType
    ? getAdmissionExamTypeLabel(examType, t)
    : '';
  const universityName = university
    ? language === 'en'
      ? university.nameEn || university.nameBn
      : university.nameBn || university.nameEn || university.slug
    : '';
  const selectedUnitName = selectedUnit
    ? language === 'en' && selectedUnit.nameEn
      ? selectedUnit.nameEn
      : selectedUnit.nameBn
    : null;

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
    ...(group && examType && university
      ? [
          {
            label: universityName,
            to: `/admission/${group.slug}/${examType}/${university.slug}`,
          },
        ]
      : []),
    { label: selectedUnitName ?? t('admission.universityExamsTitle') },
  ];

  const handleUnitSelect = (nextUnitSlug: string | null) => {
    if (nextUnitSlug) {
      setSearchParams({ unit: nextUnitSlug });
    } else {
      setSearchParams({});
    }
  };

  const handlePrepareOffline = useCallback(
    (examId: string, title: string) => {
      setPreparingId(examId);
      void offline
        .prepareExam(examId, title)
        .then(() => toast.success(t('admission.exam.preparedOffline')))
        .catch(() => toast.error(t('admission.exam.prepareFailed')))
        .finally(() => setPreparingId(null));
    },
    [offline.prepareExam, t]
  );

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
        <AdmissionSkeleton cards={4} columns={2} />
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

  if (unitSlug && !selectedUnit) {
    return (
      <div className="mx-auto w-full max-w-5xl pb-8">
        <AdmissionBreadcrumb items={breadcrumbItems} />
        <AdmissionState
          variant="not-found"
          title={t('admission.notFoundTitle')}
          message={t('admission.unitNotFound')}
          actionLabel={t('admission.allUnits')}
          onAction={() => setSearchParams({})}
        />
      </div>
    );
  }

  const examCountLabel = formatAdmissionCount(exams.length, language);

  return (
    <div className="mx-auto w-full max-w-5xl pb-8">
      <AdmissionBreadcrumb items={breadcrumbItems} />

      <header className="rounded-3xl border border-card-border bg-card-bg px-5 py-6 shadow-sm sm:px-7">
        <h1 className="font-['Noto_Sans_Bengali'] text-2xl font-bold text-text-primary sm:text-3xl">
          {t('admission.universityExamsTitle')}
        </h1>

        <p className="mt-1 font-['Noto_Sans_Bengali'] text-sm text-text-secondary sm:text-base">
          {[universityName, examTypeLabel, selectedUnitName]
            .filter(Boolean)
            .join(' • ')}
        </p>

        <p className="mt-2 text-xs font-semibold text-text-secondary">
          {t('admission.examsCount', { count: examCountLabel })}
        </p>

        {units.length > 0 && (
          <div className="mt-5">
            <h2 className="mb-2 font-['Noto_Sans_Bengali'] text-sm font-bold text-text-primary">
              {t('admission.unitsTitle')}
            </h2>
            <AdmissionUnitSelector
              units={units}
              selectedUnitSlug={selectedUnit?.slug ?? null}
              onSelect={handleUnitSelect}
            />
          </div>
        )}
      </header>

      {exams.length === 0 ? (
        <div className="mt-6">
          <AdmissionState
            variant="empty"
            title={t('admission.noExamType')}
            message={t('admission.noUniversitiesHint')}
            actionLabel={t('admission.back')}
            onAction={() =>
              navigate(`/admission/${group.slug}/${examType}`)
            }
          />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {exams.map((exam) => (
            <AdmissionExamCard
              key={exam.id}
              exam={exam}
              universityName={universityName}
              isPreparing={preparingId === exam.id}
              onPrepareOffline={(examId) => handlePrepareOffline(examId, exam.title)}
              onStart={(examId) => navigate(`/admission/exam/${examId}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AdmissionExamListPage;
