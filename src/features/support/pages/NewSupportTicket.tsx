import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ImagePlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { useCreateSupportTicket } from '../hooks/useSupportTickets';
import { getSupportApiError } from '../services/supportService';
import {
  CATEGORY_LABEL_KEYS,
  MAX_SUPPORT_ATTACHMENTS,
  isSupportCategory,
  validateAttachmentFile,
  validateTicketDraft,
} from '../utils/supportTickets';
import { SUPPORT_CATEGORIES, type SupportCategory } from '../types/supportTypes';

interface AttachmentDraft {
  file_name: string;
  mime_type: string;
  data_url: string;
  preview: string;
}

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Could not read the image'));
    reader.readAsDataURL(file);
  });

const NewSupportTicket: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const createTicket = useCreateSupportTicket();

  const requestedCategory = searchParams.get('category');
  const initialCategory: SupportCategory = isSupportCategory(requestedCategory)
    ? requestedCategory
    : 'general';

  const [category, setCategory] = useState<SupportCategory>(initialCategory);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [duplicateTicketId, setDuplicateTicketId] = useState<string | null>(null);

  const context = useMemo(
    () => ({
      question_id: searchParams.get('question_id'),
      exam_id: searchParams.get('exam_id'),
      screen: searchParams.get('screen'),
    }),
    [searchParams]
  );

  const hasContext = Boolean(context.question_id || context.exam_id);

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    let accepted = attachments.length;

    for (const file of files) {
      const validation = validateAttachmentFile(file, accepted);
      if (validation) {
        toast.error(t(validation));
        continue;
      }

      try {
        const dataUrl = await readFileAsDataUrl(file);
        setAttachments((current) => [
          ...current,
          {
            file_name: file.name.slice(0, 120),
            mime_type: file.type,
            data_url: dataUrl,
            preview: dataUrl,
          },
        ]);
        accepted += 1;
      } catch {
        toast.error(t('support.errFileRead'));
      }
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorKey(null);
    setDuplicateTicketId(null);

    const draftError = validateTicketDraft({ category, subject, description });
    if (draftError) {
      setErrorKey(draftError);
      return;
    }

    try {
      const result = await createTicket.mutateAsync({
        category,
        subject: subject.trim(),
        description: description.trim(),
        ...(hasContext
          ? {
              context: {
                question_id: context.question_id,
                exam_id: context.exam_id,
                screen: context.screen,
              },
            }
          : {}),
        ...(attachments.length > 0
          ? {
              attachments: attachments.map(({ file_name, mime_type, data_url }) => ({
                file_name,
                mime_type,
                data_url,
              })),
            }
          : {}),
      });

      toast.success(t('support.submitSuccess'));
      navigate(`/support/${result.ticket.id}`, { replace: true });
    } catch (error) {
      const apiError = getSupportApiError(error);

      if (apiError.code === 'DUPLICATE_TICKET' && apiError.ticketId) {
        setDuplicateTicketId(apiError.ticketId);
        return;
      }

      setErrorKey('support.errSubmit');
    }
  };

  return (
    <div className="min-h-screen bg-app font-['Hind_Siliguri'] text-text-primary">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border-color bg-surface/90 p-4 backdrop-blur-md">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label={t('common.back')}
          className="-ml-1 p-1 text-text-secondary transition-colors hover:text-text-primary"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-text-primary">{t('support.titleNew')}</h1>
          <p className="text-xs text-text-secondary">{t('support.subtitle')}</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="mx-auto w-full max-w-2xl space-y-4 p-4 pb-10">
        {hasContext && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm font-semibold text-text-primary">
              {t('support.contextAttached')}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              {t('support.contextHint')}
            </p>
          </div>
        )}

        <div className="space-y-4 rounded-2xl border border-card-border bg-card-bg p-4">
          <div>
            <label htmlFor="support-category" className="mb-1.5 block text-sm font-semibold">
              {t('support.category')}
            </label>
            <select
              id="support-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as SupportCategory)}
              className="w-full rounded-xl border border-input-border bg-input-bg px-3 py-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-focus-ring"
            >
              {SUPPORT_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {t(CATEGORY_LABEL_KEYS[option])}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="support-subject" className="mb-1.5 block text-sm font-semibold">
              {t('support.subject')}
            </label>
            <input
              id="support-subject"
              type="text"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={140}
              required
              placeholder={t('support.subjectPlaceholder')}
              className="w-full rounded-xl border border-input-border bg-input-bg px-3 py-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-focus-ring"
            />
          </div>

          <div>
            <label htmlFor="support-description" className="mb-1.5 block text-sm font-semibold">
              {t('support.description')}
            </label>
            <textarea
              id="support-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={5000}
              rows={7}
              required
              placeholder={t('support.descriptionPlaceholder')}
              className="w-full resize-y rounded-xl border border-input-border bg-input-bg px-3 py-3 text-sm leading-relaxed text-text-primary outline-none focus:ring-2 focus:ring-focus-ring"
            />
            <p className="mt-1 text-right text-[11px] text-text-secondary">
              {description.length}/5000
            </p>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-semibold">
              {t('support.attachOptional')}
            </p>
            <p className="mb-2 text-xs leading-relaxed text-text-secondary">
              {t('support.screenshotHint')}
            </p>

            <div className="flex flex-wrap gap-2">
              {attachments.map((attachment, index) => (
                <div
                  key={`${attachment.file_name}-${index}`}
                  className="relative h-24 w-24 overflow-hidden rounded-xl border border-border-color"
                >
                  <img
                    src={attachment.preview}
                    alt={attachment.file_name}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    aria-label={t('support.removeAttachment')}
                    className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}

              {attachments.length < MAX_SUPPORT_ATTACHMENTS && (
                <label
                  htmlFor="support-attachments"
                  className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border-color bg-surface text-text-secondary"
                >
                  <ImagePlus size={22} aria-hidden="true" />
                  <span className="text-[10px] font-semibold">{t('support.addScreenshot')}</span>
                </label>
              )}
            </div>

            <input
              id="support-attachments"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) => void handleFiles(event)}
              className="sr-only"
            />
          </div>
        </div>

        {errorKey && (
          <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {t(errorKey as Parameters<typeof t>[0])}
          </p>
        )}

        {duplicateTicketId && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {t('support.duplicateNotice')}
            </p>
            <button
              type="button"
              onClick={() => navigate(`/support/${duplicateTicketId}`)}
              className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white"
            >
              {t('support.openExisting')}
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={createTicket.isPending}
          className="w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {createTicket.isPending ? t('support.submitting') : t('support.submitTicket')}
        </button>
      </form>
    </div>
  );
};

export default NewSupportTicket;
