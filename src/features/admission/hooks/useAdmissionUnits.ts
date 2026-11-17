import { useMutation, useQuery } from '@tanstack/react-query';
import { admissionService } from '../services/admissionService';
import type { AdmissionPracticeInput } from '../types/admission';

/** Active units grouped by university; drives the admission entry screens. */
export const useAdmissionUnitCatalog = () =>
  useQuery({
    queryKey: ['admission', 'units'],
    queryFn: () => admissionService.getUniversityUnits(),
    staleTime: 5 * 60 * 1000,
  });

/**
 * One unit's sections. Keyed by unit id so switching units never reuses another
 * unit's papers or subject pool, and cached briefly to avoid refetch churn.
 */
export const useAdmissionUnitContent = (unitId: string | undefined) =>
  useQuery({
    queryKey: ['admission', 'unit-content', unitId],
    queryFn: () => admissionService.getUnitContent(unitId ?? ''),
    enabled: Boolean(unitId),
    staleTime: 2 * 60 * 1000,
  });

/** Starts a subject practice attempt for the current unit. */
export const useStartAdmissionPractice = (unitId: string | undefined) =>
  useMutation({
    mutationFn: (input: AdmissionPracticeInput) =>
      admissionService.startPractice(unitId ?? '', input),
  });
