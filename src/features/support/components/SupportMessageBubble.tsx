import React from 'react';
import { MessageCircle, User } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { formatSupportDate } from '../utils/supportTickets';
import type { SupportMessage } from '../types/supportTypes';

const SupportMessageBubble: React.FC<{ message: SupportMessage }> = ({ message }) => {
  const { t, language } = useLanguage();
  const isStaff = message.author_role === 'staff';
  const authorName = isStaff
    ? t('support.supportTeam')
    : message.author?.full_name?.trim() ||
      message.author?.username?.trim() ||
      t('support.you');

  return (
    <li className={`flex gap-2.5 ${isStaff ? '' : 'flex-row-reverse'}`}>
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isStaff
            ? 'bg-primary/10 text-primary'
            : 'bg-surface-elevated text-text-secondary'
        }`}
      >
        {isStaff ? <MessageCircle size={16} /> : <User size={16} />}
      </span>

      <div className={`min-w-0 max-w-[85%] ${isStaff ? '' : 'items-end'}`}>
        <div
          className={`mb-1 flex items-center gap-2 text-[11px] text-text-secondary ${
            isStaff ? '' : 'justify-end'
          }`}
        >
          <span className="font-semibold text-text-primary">{authorName}</span>
          <span>{formatSupportDate(message.created_at, language)}</span>
        </div>

        <div
          className={`rounded-2xl border px-3.5 py-2.5 text-[14px] leading-relaxed ${
            isStaff
              ? 'rounded-tl-sm border-border-color bg-surface text-text-primary'
              : 'rounded-tr-sm border-primary/20 bg-primary/10 text-text-primary'
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{message.body}</p>

          {message.attachments.length > 0 && (
            <ul className="mt-3 grid grid-cols-2 gap-2">
              {message.attachments.map((attachment) => (
                <li key={`${message.id}-${attachment.url}`}>
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-xl border border-border-color"
                  >
                    <img
                      src={attachment.url}
                      alt={attachment.name}
                      loading="lazy"
                      className="h-24 w-full bg-surface object-cover"
                    />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
};

export default SupportMessageBubble;
