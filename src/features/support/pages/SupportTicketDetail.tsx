import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Lock, RotateCcw, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import SupportStatusBadge from '../components/SupportStatusBadge';
import SupportMessageBubble from '../components/SupportMessageBubble';
import {
  useReopenSupportTicket,
  useReplyToSupportTicket,
  useSupportTicket,
} from '../hooks/useSupportTickets';
import {
  CATEGORY_LABEL_KEYS,
  canReopen,
  canStudentReply,
  formatSupportDate,
} from '../utils/supportTickets';

const SupportTicketDetail: React.FC = () => {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [reply, setReply] = useState('');

  const { data, isLoading, isError, refetch } = useSupportTicket(ticketId);
  const replyMutation = useReplyToSupportTicket(ticketId ?? '');
  const reopenMutation = useReopenSupportTicket(ticketId ?? '');

  const handleReply = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = reply.trim();
    if (!body) return;

    try {
      await replyMutation.mutateAsync(body);
      setReply('');
      toast.success(t('support.replySuccess'));
    } catch {
      toast.error(t('support.replyError'));
    }
  };

  const handleReopen = async () => {
    try {
      await reopenMutation.mutateAsync();
      toast.success(t('support.reopenSuccess'));
    } catch {
      toast.error(t('support.reopenError'));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen space-y-4 bg-app p-4">
        <Skeleton className="h-14 w-full rounded-2xl bg-surface" />
        <Skeleton className="h-40 w-full rounded-2xl bg-surface" />
        <Skeleton className="h-64 w-full rounded-2xl bg-surface" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-app p-6 text-center">
        <p className="text-lg font-bold text-text-primary">{t('support.notFound')}</p>
        <p className="mt-1 text-sm text-text-secondary">{t('support.notFoundHint')}</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-xl border border-border-color bg-surface px-4 py-2 text-sm font-semibold"
          >
            {t('common.retry')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/support')}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            {t('support.backToSupport')}
          </button>
        </div>
      </div>
    );
  }

  const { ticket, messages } = data;
  const closed = ticket.status === 'closed';
  const resolved = ticket.status === 'resolved';
  const replyAllowed = canStudentReply(ticket.status);

  return (
    <div className="min-h-screen bg-app pb-28 font-['Noto_Sans_Bengali'] text-text-primary">
      <header className="sticky top-0 z-30 border-b border-border-color bg-surface/90 backdrop-blur-md">
        <div className="flex items-center gap-3 p-4">
          <button
            type="button"
            onClick={() => navigate('/support')}
            aria-label={t('support.backToSupport')}
            className="-ml-1 p-1 text-text-secondary transition-colors hover:text-text-primary"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] font-semibold text-text-secondary">
              {ticket.ticket_ref}
            </p>
            <h1 className="truncate text-base font-bold text-text-primary">{ticket.subject}</h1>
          </div>
          <SupportStatusBadge status={ticket.status} />
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl space-y-4 p-4">
        <section className="rounded-2xl border border-card-border bg-card-bg p-4">
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-text-secondary">
            <span className="rounded-full bg-surface px-2 py-0.5">
              {t(CATEGORY_LABEL_KEYS[ticket.category])}
            </span>
            <span>{formatSupportDate(ticket.created_at, language)}</span>
          </div>

          {(ticket.context_question_id || ticket.context_exam_id) && (
            <div className="mt-3 rounded-xl border border-border-color bg-surface p-3">
              <p className="text-xs font-semibold text-text-primary">
                {t('support.contextTitle')}
              </p>
              <dl className="mt-1 space-y-0.5 text-[11px] text-text-secondary">
                {ticket.context_question_id && (
                  <div className="flex gap-1">
                    <dt>{t('support.contextQuestion')}:</dt>
                    <dd className="truncate font-mono">{ticket.context_question_id}</dd>
                  </div>
                )}
                {ticket.context_exam_id && (
                  <div className="flex gap-1">
                    <dt>{t('support.contextExam')}:</dt>
                    <dd className="truncate font-mono">{ticket.context_exam_id}</dd>
                  </div>
                )}
              </dl>
              {ticket.context_screen && (
                <button
                  type="button"
                  onClick={() => navigate(ticket.context_screen as string)}
                  className="mt-2 text-xs font-semibold text-primary underline-offset-2 hover:underline"
                >
                  {t('support.openContext')}
                </button>
              )}
            </div>
          )}
        </section>

        {resolved && (
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                {t('support.resolvedNotice')}
              </p>
              {canReopen(ticket.status) && (
                <button
                  type="button"
                  onClick={() => void handleReopen()}
                  disabled={reopenMutation.isPending}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                >
                  <RotateCcw size={14} aria-hidden="true" />
                  {reopenMutation.isPending ? t('common.pleaseWait') : t('support.reopen')}
                </button>
              )}
            </div>
          </div>
        )}

        {closed && (
          <div className="flex items-start gap-3 rounded-2xl border border-border-color bg-surface p-4">
            <Lock size={18} className="mt-0.5 shrink-0 text-text-secondary" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-text-secondary">
              {t('support.closedNotice')}
            </p>
          </div>
        )}

        <section aria-label={t('support.conversation')}>
          <h2 className="mb-2 px-1 text-[13px] font-semibold text-primary">
            {t('support.conversation')}
          </h2>
          <ul className="space-y-4">
            {messages.map((message) => (
              <SupportMessageBubble key={message.id} message={message} />
            ))}
          </ul>
        </section>
      </div>

      {replyAllowed && (
        <form
          onSubmit={handleReply}
          className="fixed inset-x-0 bottom-0 z-30 border-t border-border-color bg-surface-elevated/95 p-3 backdrop-blur-md"
        >
          <div className="mx-auto flex max-w-2xl items-end gap-2">
            <label htmlFor="support-reply" className="sr-only">
              {t('support.replyPlaceholder')}
            </label>
            <textarea
              id="support-reply"
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              rows={1}
              maxLength={5000}
              placeholder={t('support.replyPlaceholder')}
              className="max-h-32 min-h-[46px] flex-1 resize-y rounded-xl border border-input-border bg-input-bg px-3 py-2.5 text-sm text-text-primary outline-none focus:ring-2 focus:ring-focus-ring"
            />
            <button
              type="submit"
              disabled={!reply.trim() || replyMutation.isPending}
              className="flex h-[46px] shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              <Send size={16} aria-hidden="true" />
              <span className="hidden sm:inline">
                {replyMutation.isPending ? t('support.sending') : t('support.sendReply')}
              </span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default SupportTicketDetail;
