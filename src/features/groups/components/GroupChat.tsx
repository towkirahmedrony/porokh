import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, Flag, MoreVertical, Reply, Send, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import EmptyState from '@/shared/components/ui/EmptyState';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { GROUP_QUERY_KEYS, useGroupMessages } from '../hooks/useGroupQueries';
import { groupsService } from '../services/groupsService';
import { resolveGroupErrorMessage } from '../utils/errorMessages';
import type { GroupMessage, GroupReplyMeta } from '../types';

type GroupChatProps = {
  groupId: string;
  groupSlug: string;
  canSend: boolean;
  isAdmin?: boolean;
};

type ReportDraft = {
  message: GroupMessage;
  offenseType: 'Profanity' | 'Spam' | 'Harassment' | 'Other';
  reason: string;
};

const MAX_LENGTH = 500;

const formatTime = (value: string, language: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(language === 'bn' ? 'bn-BD' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const dateKey = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const replyMeta = (message: GroupMessage): GroupReplyMeta | null => {
  const raw = (message.meta_data as Record<string, unknown> | null)?.reply_to;
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Record<string, unknown>;
  const id = String(candidate.id ?? '');
  if (!id) return null;
  return {
    id,
    sender_name: String(candidate.sender_name ?? 'Student'),
    snippet: String(candidate.snippet ?? ''),
  };
};

const SystemNotice: React.FC<{ message: GroupMessage; groupSlug: string }> = ({
  message,
  groupSlug,
}) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const meta = (message.meta_data as Record<string, unknown> | null) ?? {};
  const event = String(meta.event ?? '');
  const battleId = String(meta.battle_id ?? '');
  const label =
    event === 'battle_created'
      ? t('groups.battleCreated')
      : event === 'battle_finished'
        ? t('groups.completed')
        : t('groups.battle');

  return (
    <div className="my-3 text-center">
      <span className="inline-block rounded-full bg-secondary px-3 py-1 text-xs text-text-secondary">
        {label}
        {message.content ? ` · ${message.content}` : ''}
      </span>
      {battleId && (
        <button
          type="button"
          onClick={() => navigate(`/groups/${groupSlug}/battles/${battleId}`)}
          className="ml-2 text-xs font-semibold text-primary"
        >
          {t('groups.open')}
        </button>
      )}
    </div>
  );
};

export const GroupChat: React.FC<GroupChatProps> = ({
  groupId,
  groupSlug,
  canSend,
  isAdmin = false,
}) => {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [older, setOlder] = useState<GroupMessage[]>([]);
  const [olderHasMore, setOlderHasMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null);
  const [report, setReport] = useState<ReportDraft | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottom = useRef(true);
  const longPressTimer = useRef<number | null>(null);

  const { data, isLoading, isError, refetch } = useGroupMessages(groupId);
  const messages = useMemo(() => data?.messages ?? [], [data?.messages]);
  const allMessages = useMemo(() => {
    const seen = new Set<string>();
    return [...older, ...messages].filter((message) => {
      if (seen.has(message.id)) return false;
      seen.add(message.id);
      return true;
    });
  }, [older, messages]);

  const invalidateMessages = () =>
    queryClient.invalidateQueries({ queryKey: GROUP_QUERY_KEYS.messages(groupId) });

  const sendMutation = useMutation({
    mutationFn: (value: string) =>
      groupsService.postMessage(groupId, value, 'text', replyTo?.id ?? null),
    onSuccess: () => {
      setContent('');
      setReplyTo(null);
      shouldStickToBottom.current = true;
      void invalidateMessages();
      toast.success(t('groups.sendSuccess'));
    },
    onError: (error) => {
      toast.error(resolveGroupErrorMessage(error, language));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (messageId: string) => groupsService.deleteMessage(groupId, messageId),
    onSuccess: () => {
      setOpenMenuId(null);
      void invalidateMessages();
      toast.success(t('groups.saved'));
    },
    onError: (error) => toast.error(resolveGroupErrorMessage(error, language)),
  });

  const reportMutation = useMutation({
    mutationFn: (draft: ReportDraft) =>
      groupsService.reportMessage(
        groupId,
        draft.message.id,
        draft.offenseType,
        draft.reason || null
      ),
    onSuccess: () => {
      setReport(null);
      toast.success(t('groups.reportSuccess'));
      void invalidateMessages();
    },
    onError: (error) => toast.error(resolveGroupErrorMessage(error, language)),
  });

  useEffect(() => {
    if (shouldStickToBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [allMessages.length]);

  useEffect(() => {
    setOlder([]);
    setOlderHasMore(true);
    setReplyTo(null);
    setOpenMenuId(null);
    shouldStickToBottom.current = true;
  }, [groupId]);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="ml-auto h-12 w-2/3" />
        <Skeleton className="h-12 w-4/5" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-8 text-center">
        <p className="mb-3 text-sm text-text-secondary">{t('common.retry')}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          {t('groups.retry')}
        </button>
      </div>
    );
  }

  const loadOlder = async () => {
    const oldest = allMessages[0]?.created_at;
    if (!oldest || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await groupsService.getMessages(groupId, { before: oldest, limit: 30 });
      setOlder((prev) => [...page.messages, ...prev]);
      if (!page.hasMore || page.messages.length === 0) setOlderHasMore(false);
    } catch (error) {
      toast.error(resolveGroupErrorMessage(error, language));
    } finally {
      setLoadingOlder(false);
    }
  };

  const copyMessage = async (message: GroupMessage) => {
    try {
      await navigator.clipboard.writeText(message.content ?? '');
      toast.success(t('groups.messageCopied'));
    } catch {
      toast.error(t('groups.shareFailed'));
    }
    setOpenMenuId(null);
  };

  const jumpToMessage = (messageId: string) => {
    const element = document.getElementById(`group-message-${messageId}`);
    if (!element) {
      toast(t('groups.replyUnavailable'));
      return;
    }
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.classList.add('ring-2', 'ring-primary/50');
    window.setTimeout(() => element.classList.remove('ring-2', 'ring-primary/50'), 1400);
  };

  const formatDateLabel = (value: string): string => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (dateKey(value) === dateKey(today.toISOString())) return t('groups.today');
    if (dateKey(value) === dateKey(yesterday.toISOString())) return t('groups.yesterday');
    return date.toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const senderNameOf = (message: GroupMessage): string =>
    message.sender?.full_name || message.sender?.username || 'Student';

  return (
    <div className="flex min-h-[50vh] flex-col">
      <div
        ref={listRef}
        className="max-h-[55vh] flex-1 space-y-2 overflow-y-auto pr-1"
        onScroll={() => {
          const element = listRef.current;
          if (!element) return;
          shouldStickToBottom.current =
            element.scrollHeight - element.scrollTop - element.clientHeight < 80;
        }}
      >
        {olderHasMore && allMessages.length >= 30 && (
          <div className="pb-2 text-center">
            <button
              type="button"
              onClick={() => void loadOlder()}
              disabled={loadingOlder}
              className="text-xs font-medium text-primary disabled:opacity-50"
            >
              {loadingOlder ? t('common.loading') : t('groups.loadOlder')}
            </button>
          </div>
        )}
        {allMessages.length === 0 ? (
          <EmptyState message={t('groups.noMessages')} />
        ) : (
          allMessages.map((message, index) => {
            if (message.message_type === 'system_alert') {
              return (
                <SystemNotice key={message.id} message={message} groupSlug={groupSlug} />
              );
            }

            const previous = allMessages[index - 1];
            const showDate =
              !previous || dateKey(previous.created_at) !== dateKey(message.created_at);
            const isMine = message.sender_id === user?.id;
            const name = senderNameOf(message);
            const quoted = replyMeta(message);
            const canDelete = isMine || isAdmin;
            const menuOpen = openMenuId === message.id;

            return (
              <React.Fragment key={message.id}>
                {showDate && (
                  <div className="py-2 text-center">
                    <span className="rounded-full bg-secondary px-3 py-1 text-[11px] text-text-secondary">
                      {formatDateLabel(message.created_at)}
                    </span>
                  </div>
                )}
                <div
                  id={`group-message-${message.id}`}
                  className={`flex rounded-xl transition ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[84%] rounded-2xl px-3 py-2 ${
                      isMine
                        ? 'rounded-br-sm bg-primary text-primary-foreground'
                        : 'rounded-bl-sm border border-card-border bg-card-bg text-text-primary'
                    }`}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setOpenMenuId(menuOpen ? null : message.id);
                    }}
                    onTouchStart={() => {
                      if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
                      longPressTimer.current = window.setTimeout(() => {
                        setOpenMenuId(message.id);
                      }, 450);
                    }}
                    onTouchEnd={() => {
                      if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
                    }}
                    onTouchMove={() => {
                      if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
                    }}
                  >
                    {!isMine && (
                      <p className="mb-0.5 text-[11px] font-semibold opacity-80">{name}</p>
                    )}
                    {quoted && (
                      <button
                        type="button"
                        onClick={() => jumpToMessage(quoted.id)}
                        className={`mb-1 block w-full rounded-lg border-l-2 px-2 py-1 text-left text-[11px] ${
                          isMine
                            ? 'border-primary-foreground/50 bg-primary-foreground/10'
                            : 'border-primary bg-secondary'
                        }`}
                      >
                        <span className="block font-semibold">{quoted.sender_name}</span>
                        <span className="block truncate opacity-80">{quoted.snippet}</span>
                      </button>
                    )}
                    <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                    <div className="mt-1 flex items-center justify-end gap-1">
                      {message.is_flagged && (
                        <Flag className="h-3 w-3 opacity-70" aria-label={t('groups.report')} />
                      )}
                      <span
                        className={`text-[10px] ${isMine ? 'text-primary-foreground/70' : 'text-text-secondary'}`}
                      >
                        {formatTime(message.created_at, language)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setOpenMenuId(menuOpen ? null : message.id)}
                        aria-label={t('groups.messageOptions')}
                        className={`ml-1 rounded p-0.5 ${isMine ? 'text-primary-foreground/80' : 'text-text-secondary'}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>

                    {menuOpen && (
                      <div className="mt-2 flex flex-wrap gap-1 border-t border-current/10 pt-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => void copyMessage(message)}
                          className="inline-flex items-center gap-1 rounded-md bg-black/10 px-2 py-1"
                        >
                          <Copy className="h-3 w-3" /> {t('groups.copyMessage')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReplyTo(message);
                            setOpenMenuId(null);
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-black/10 px-2 py-1"
                        >
                          <Reply className="h-3 w-3" /> {t('groups.reply')}
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(t('groups.deleteConfirm'))) {
                                deleteMutation.mutate(message.id);
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-black/10 px-2 py-1 text-red-500"
                          >
                            <Trash2 className="h-3 w-3" /> {t('groups.deleteMessage')}
                          </button>
                        )}
                        {!isMine && (
                          <button
                            type="button"
                            onClick={() => {
                              setReport({
                                message,
                                offenseType: 'Other',
                                reason: '',
                              });
                              setOpenMenuId(null);
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-black/10 px-2 py-1"
                          >
                            <Flag className="h-3 w-3" /> {t('groups.report')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {report && (
        <div className="mt-3 rounded-xl border border-card-border bg-card-bg p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-text-primary">{t('groups.reportMessage')}</p>
            <button
              type="button"
              onClick={() => setReport(null)}
              aria-label={t('common.cancel')}
            >
              <X className="h-4 w-4 text-text-secondary" />
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              value={report.offenseType}
              onChange={(event) =>
                setReport((current) =>
                  current
                    ? {
                        ...current,
                        offenseType: event.target.value as ReportDraft['offenseType'],
                      }
                    : current
                )
              }
              className="rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-text-primary"
            >
              <option value="Profanity">Profanity</option>
              <option value="Spam">Spam</option>
              <option value="Harassment">Harassment</option>
              <option value="Other">Other</option>
            </select>
            <input
              value={report.reason}
              onChange={(event) =>
                setReport((current) =>
                  current ? { ...current, reason: event.target.value.slice(0, 200) } : current
                )
              }
              placeholder={t('groups.reportReason')}
              maxLength={200}
              className="rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-text-primary"
            />
          </div>
          <button
            type="button"
            disabled={reportMutation.isPending}
            onClick={() => reportMutation.mutate(report)}
            className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {t('groups.report')}
          </button>
        </div>
      )}

      {canSend && (
        <form
          className="mt-3 flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = content.trim();
            if (!trimmed || sendMutation.isPending) return;
            sendMutation.mutate(trimmed);
          }}
        >
          <div className="min-w-0 flex-1">
            {replyTo && (
              <div className="mb-1 flex items-center gap-2 rounded-lg border-l-2 border-primary bg-secondary px-2 py-1 text-[11px]">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-text-primary">
                    {t('groups.replyingTo', { name: senderNameOf(replyTo) })}
                  </p>
                  <p className="truncate text-text-secondary">{replyTo.content}</p>
                </div>
                <button type="button" onClick={() => setReplyTo(null)} aria-label={t('common.cancel')}>
                  <X className="h-3.5 w-3.5 text-text-secondary" />
                </button>
              </div>
            )}
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value.slice(0, MAX_LENGTH))}
              maxLength={MAX_LENGTH}
              rows={1}
              placeholder={t('groups.messagePlaceholder')}
              className="min-h-[44px] w-full resize-none rounded-xl border border-input-border bg-input-bg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-focus-ring"
            />
          </div>
          <button
            type="submit"
            disabled={!content.trim() || sendMutation.isPending}
            aria-label={t('groups.send')}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      )}
      {canSend && (
        <p className="mt-1 text-right text-[10px] text-text-secondary">
          {content.length}/{MAX_LENGTH}
        </p>
      )}
    </div>
  );
};

export default GroupChat;
