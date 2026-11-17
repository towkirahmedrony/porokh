import { useQuery } from '@tanstack/react-query';
import { modelPaperService } from '../services/modelPaperService';

export const useModelTrackSummary = () => {
  return useQuery({
    queryKey: ['model-track-summary'],
    queryFn: () => modelPaperService.getTrackSummary(),
    staleTime: 2 * 60 * 1000,
  });
};
