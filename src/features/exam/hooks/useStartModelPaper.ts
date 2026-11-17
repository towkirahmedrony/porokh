import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import {
  modelPaperService,
  type ModelPaperListItem,
} from '../services/modelPaperService';

export const useStartModelPaper = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (paper: ModelPaperListItem) => modelPaperService.startAttempt(paper.id),
    onSuccess: (attempt) => {
      navigate(`/exam/attempt/${attempt.id}`);
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error(message || t('exam.startError'));
    },
  });
};
