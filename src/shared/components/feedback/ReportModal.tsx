import React, { useState, useCallback, useEffect, memo } from 'react';
import { X, AlertTriangle, MessageSquare, CheckCircle, Bug, FileQuestion } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { useBackInterceptor } from '@/app/navigation/useBackInterceptor';
import type { AppMessageKey } from '@/shared/i18n/messages';
import QuestionText from '@/shared/components/content/QuestionText';
import MathDisplay from '@/shared/components/content/MathDisplay';

export type ReportType = 'app_bug' | 'question_issue';

const APP_ISSUES = [
  { value: 'ui_bug', labelKey: 'report.appIssue_ui_bug' },
  { value: 'functional_bug', labelKey: 'report.appIssue_functional_bug' },
  { value: 'performance', labelKey: 'report.appIssue_performance' },
  { value: 'login_issue', labelKey: 'report.appIssue_login_issue' },
  { value: 'feature_request', labelKey: 'report.appIssue_feature_request' },
  { value: 'other', labelKey: 'report.appIssue_other' },
] as const satisfies readonly { value: string; labelKey: AppMessageKey }[];

const QUESTION_ISSUES = [
  { value: 'wrong_answer', labelKey: 'report.question_wrong_answer' },
  { value: 'wrong_stem', labelKey: 'report.question_wrong_stem' },
  { value: 'spelling_error', labelKey: 'report.question_spelling_error' },
  { value: 'image_issue', labelKey: 'report.question_image_issue' },
  { value: 'out_of_syllabus', labelKey: 'report.question_out_of_syllabus' },
  { value: 'confusing', labelKey: 'report.question_confusing' },
] as const satisfies readonly { value: string; labelKey: AppMessageKey }[];

export interface QuestionReportOption {
  id?: string;
  text: string;
}

export interface QuestionMetaData {
  questionId: string;
  examId?: string;
  questionText?: string;
  questionOptions?: QuestionReportOption[];
  imageUrl?: string | null;
}

export interface ReportPayload {
  type: 'question' | 'bug_report';
  report_reason: string;
  description: string | null;
  status: string;
  created_at: string;
  target_question_id?: string;
  target_exam_id?: string | null;
}

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: ReportType; 
  questionData?: QuestionMetaData | null;
  onSubmit: (data: ReportPayload) => Promise<void> | void;
}

const ReportModal: React.FC<ReportModalProps> = memo(({ 
  isOpen, 
  onClose, 
  type, 
  questionData, 
  onSubmit 
}) => {
  const { t } = useLanguage();
  const [issueCategory, setIssueCategory] = useState<string>('');
  const [descriptionText, setDescriptionText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setIssueCategory('');
      setDescriptionText('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!issueCategory) {
      toast.error(t('report.selectTypePrompt'));
      return;
    }

    setIsSubmitting(true);

    try {
      const dbReportType = type === 'question_issue' ? 'question' : 'bug_report';

      const reportPayload: ReportPayload = {
        type: dbReportType, 
        report_reason: issueCategory,
        description: descriptionText.trim() || null,
        status: 'pending',
        created_at: new Date().toISOString(),
        ...(type === 'question_issue' && questionData ? {
          target_question_id: questionData.questionId,
        } : {})
      };

      await onSubmit(reportPayload);
      handleClose();
    } catch (error) {
      console.error("Failed to submit report:", error);
      toast.error(t('report.submitError'));
      setIsSubmitting(false);
    }
  }, [issueCategory, descriptionText, type, questionData, onSubmit, handleClose, t]);

  // Android Back closes the report form; the submit guard is preserved.
  useBackInterceptor(handleClose, isOpen);

  if (!isOpen) return null;

  const isQuestion = type === 'question_issue';
  const options = isQuestion ? QUESTION_ISSUES : APP_ISSUES;
  const title = isQuestion ? t('report.titleQuestion') : t('report.titleApp');
  const Icon = isQuestion ? FileQuestion : Bug;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200 bg-black/70"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 bg-surface-elevated border border-border-color"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 flex justify-between items-center bg-secondary/30 border-b border-border-color">
          <div className="flex items-center gap-2 font-bold text-lg text-text-primary">
            <Icon className="text-primary" size={20} aria-hidden="true" />
            {title}
          </div>
          <button 
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-1 rounded-full text-text-primary hover:bg-secondary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={t('report.closeAria')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          
          {/* Context Info */}
          {isQuestion && (
            <div className="rounded-lg p-3 flex items-start gap-3 bg-accent/10 border border-accent/20">
              <AlertTriangle className="flex-shrink-0 mt-0.5 text-accent" size={16} aria-hidden="true" />
              <div className="min-w-0 flex-1 space-y-2 text-xs text-text-primary">
                <p className="font-semibold">{t('report.contextIntro')}</p>
                {questionData?.questionText ? (
                  <div className="max-h-48 overflow-y-auto rounded-md border border-border-color bg-surface px-3 py-2 text-[13px] leading-relaxed">
                    <QuestionText text={questionData.questionText} />
                  </div>
                ) : (
                  <p className="italic text-text-secondary">
                    {t('report.questionUnavailable')}
                  </p>
                )}
                {questionData?.imageUrl && (
                  <img
                    src={questionData.imageUrl}
                    alt={t('exam.questionImageAlt')}
                    className="max-h-40 w-full rounded-md border border-border-color bg-surface object-contain"
                  />
                )}
                {questionData?.questionOptions && questionData.questionOptions.length > 0 && (
                  <ol className="space-y-1.5">
                    {questionData.questionOptions.map((option, index) => (
                      <li key={option.id || `${option.text}-${index}`} className="flex items-start gap-2">
                        <span className="mt-0.5 min-w-[1.25rem] rounded bg-badge-bg px-1 py-0.5 text-center text-[10px] font-bold font-mono text-badge-text">
                          {String.fromCharCode(65 + index)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <MathDisplay content={option.text} />
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          )}

          {/* Issue Type Dropdown */}
          <div className="space-y-2">
            <label 
              htmlFor="issueCategory"
              className="text-sm font-medium flex items-center gap-2 text-text-secondary"
            >
              <CheckCircle className="text-primary" size={14} aria-hidden="true" />
              {t('report.selectIssueLabel')} <span className="text-accent">*</span>
            </label>
            <select
              id="issueCategory"
              value={issueCategory}
              onChange={(e) => setIssueCategory(e.target.value)}
              disabled={isSubmitting}
              className="w-full text-sm rounded-lg px-3 py-3 outline-none transition-all appearance-none cursor-pointer bg-input-bg border border-input-border text-text-primary focus:ring-2 focus:ring-focus-ring disabled:opacity-60"
            >
              <option value="" disabled className="bg-surface">{t('report.selectPlaceholder')}</option>
              {options.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-surface">
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </div>

          {/* Description Textarea */}
          <div className="space-y-2">
            <label 
              htmlFor="descriptionText"
              className="text-sm font-medium flex items-center gap-2 text-text-secondary"
            >
              <MessageSquare size={14} aria-hidden="true" />
              {t('report.detailsLabel')}
            </label>
            <textarea
              id="descriptionText"
              value={descriptionText}
              onChange={(e) => setDescriptionText(e.target.value)}
              disabled={isSubmitting}
              placeholder={t('report.detailsPlaceholder')}
              rows={4}
              className="w-full text-sm rounded-lg px-3 py-3 outline-none transition-all resize-none bg-input-bg border border-input-border text-text-primary focus:ring-2 focus:ring-focus-ring disabled:opacity-60"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 flex gap-3 justify-end bg-secondary/10 border-t border-border-color">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-text-secondary hover:text-text-primary disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !issueCategory}
            className="px-6 py-2 rounded-lg text-sm font-bold shadow-lg transition-all flex items-center gap-2 bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-95"
          >
            {isSubmitting ? t('report.submitting') : t('common.submit')}
          </button>
        </div>
      </div>
    </div>
  );
});

ReportModal.displayName = 'ReportModal';

export default ReportModal;
