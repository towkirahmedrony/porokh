import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import apiClient from '@/shared/lib/apiClient';
import { Question, ExamResultData } from '../types/exam';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { postExamSubmission } from '../utils/examSubmissionRequest';

// ১. কাস্টম এক্সাম বা প্রশ্ন জেনারেট করা
export const useGenerateExam = (topicIds: string[], questionCount: number) => {
  return useQuery({
    queryKey: ['generate-exam', topicIds, questionCount],
    queryFn: async (): Promise<Question[]> => {
      const response = await apiClient.post('/exams/user/generate', {
        topics: topicIds,
        limit: questionCount
      });
      return response.data.data;
    },
    enabled: false, 
  });
};

// ২. এক্সাম সাবমিট করে রেজাল্ট সেভ করা
export const useSubmitExamResult = () => {
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  return useMutation({
    mutationFn: async (resultData: ExamResultData) => {
      // 🌟 ফিক্স: ব্যাকএন্ডের SubmitExamDTO এর সাথে ফিল্ডগুলো ম্যাপ করা হলো
      const payload = {
        exam_id: resultData.exam_id,
        answers: resultData.userAnswers,
        time_taken: resultData.timeSpentSeconds
      };

      // 🌟 ফিক্স: পাথ থেকে '/api/v1/' সরানো হয়েছে
      const response = await postExamSubmission(payload);
      return response.data.data;
    },
    onSuccess: () => {
      // Finishing an exam can change quota state; refresh the authoritative view.
      queryClient.invalidateQueries({ queryKey: ['me', 'access'] });
    },
    onError: () => {
      toast.error(t('exam.submitFailed'));
    }
  });
};
