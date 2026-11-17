import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import SupportStatusBadge from './SupportStatusBadge';
import {
  CATEGORY_LABEL_KEYS,
  formatSupportDate,
} from '../utils/supportTickets';
import type { SupportTicket } from '../types/supportTypes';

interface SupportTicketCardProps {
  ticket: SupportTicket;
  onOpen: (ticketId: string) => void;
}

const SupportTicketCard: React.FC<SupportTicketCardProps> = ({ ticket, onOpen }) => {
  const { t, language } = useLanguage();

  return (
    <button
      type="button"
      onClick={() => onOpen(ticket.id)}
      className="w-full rounded-2xl border border-card-border bg-card-bg p-4 text-left transition-colors active:bg-surface-elevated/70 sm:hover:bg-surface-elevated/50"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-[11px] font-semibold tracking-wide text-text-secondary">
          {ticket.ticket_ref}
        </span>
        <SupportStatusBadge status={ticket.status} />
      </div>

      <p className="mt-2 line-clamp-2 text-[15px] font-semibold leading-6 text-text-primary">
        {ticket.subject}
      </p>

      <div className="mt-3 flex items-center gap-2 text-[12px] text-text-secondary">
        <span className="rounded-full bg-surface px-2 py-0.5">
          {t(CATEGORY_LABEL_KEYS[ticket.category])}
        </span>
        <span aria-hidden="true">·</span>
        <span className="min-w-0 flex-1 truncate">
          {formatSupportDate(ticket.updated_at, language)}
        </span>
        <ChevronRight size={16} className="shrink-0" aria-hidden="true" />
      </div>
    </button>
  );
};

export default SupportTicketCard;
