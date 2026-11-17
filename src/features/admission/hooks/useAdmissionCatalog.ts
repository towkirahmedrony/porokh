import { useQuery } from '@tanstack/react-query';
import { admissionService } from '../services/admissionService';
import type { AdmissionExamPaperRow } from '../types/admission';

export const admissionCatalogQueryKey = ['admission', 'catalog'] as const;

export const useAdmissionCatalog = () =>
  useQuery({
    queryKey: admissionCatalogQueryKey,
    queryFn: () => admissionService.getCatalog(),
    staleTime: 5 * 60 * 1000,
  });

export const useAdmissionExamPaper = (examId: string | undefined) =>
  useQuery<AdmissionExamPaperRow | null>({
    queryKey: ['admission', 'exam-paper', examId],
    queryFn: () => admissionService.getExamPaper(examId ?? ''),
    enabled: Boolean(examId),
    staleTime: 5 * 60 * 1000,
  });
