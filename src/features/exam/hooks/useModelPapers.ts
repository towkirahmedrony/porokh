import { useQuery } from '@tanstack/react-query';
import type { ModelPaperScope, ModelTrack } from '../constants/modelTracks';
import { modelPaperService } from '../services/modelPaperService';

export const useModelPapers = ({
  track,
  scope,
  subjectId,
}: {
  track: ModelTrack;
  scope: ModelPaperScope;
  subjectId?: string | null;
}) => {
  return useQuery({
    queryKey: ['model-papers', track, scope, subjectId ?? 'all'],
    queryFn: () =>
      modelPaperService.getPapers({
        track,
        scope,
        subjectId,
      }),
    enabled: scope === 'full' || Boolean(subjectId),
    staleTime: 2 * 60 * 1000,
  });
};
