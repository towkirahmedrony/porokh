import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  BookOpen,
  Bot,
  ChevronDown,
  History,
  Info,
  Loader2,
  MessageCircle,
  RefreshCcw,
  Send,
  Sparkles,
  Trash2,
  User,
  X,
} from 'lucide-react';

import { fetchAiSubjects, sendChatMessage } from '../services/aiService';
import type { Subject } from '../types/ai';
import { useAuth } from '../../auth/hooks/useAuth';
import { supabase } from '@/shared/lib/supabase';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { pickLang } from '@/shared/i18n/localize';
import { LOCALE_BY_LANGUAGE, type AppLanguage, type AppMessageKey } from '@/shared/i18n/messages';

type ChatRole = 'user' | 'assistant' | 'system';
type ChatMessageStatus = 'sending' | 'sent' | 'failed';

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  status: ChatMessageStatus;
  createdAt: number;
}

interface ChatSession {
  id: string;
  title: string;
  subjectId: string | null;
  createdAt: string | null;
  lastActiveAt: string | null;
}

interface SendMessageVariables {
  localMessageId: string;
  message: string;
  subjectId: string;
  sessionId: string | null;
}

interface AiSessionRow {
  id: string | null;
  session_title: string | null;
  subject_id: string | null;
  created_at: string | null;
  last_active_at: string | null;
}

interface AiMessageRow {
  id: string | null;
  role: string | null;
  content: string | null;
  created_at: string | null;
}

const MAX_MESSAGE_LENGTH = 1200;
const SESSION_LIMIT = 40;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const toStringOrNull = (value: unknown): string | null => {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
};

const createId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const toTimestamp = (value: string | null): number => {
  if (!value) return Date.now();

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Date.now();
};

const toSafeRole = (role: string | null): ChatRole => {
  if (role === 'user' || role === 'assistant' || role === 'system') {
    return role;
  }

  return 'assistant';
};

const getSafeErrorMessage = (error: unknown): AppMessageKey => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('fetch')) {
      return 'ai.errorNetwork';
    }

    if (message.includes('unauthorized') || message.includes('401')) {
      return 'ai.errorSessionExpired';
    }

    if (message.includes('quota') || message.includes('limit') || message.includes('429')) {
      return 'ai.errorLimit';
    }
  }

  return 'ai.errorGeneric';
};

const formatTime = (timestamp: number, language: AppLanguage): string => {
  return new Intl.DateTimeFormat(LOCALE_BY_LANGUAGE[language], {
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp);
};

const formatSessionDate = (value: string | null, language: AppLanguage): string => {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat(LOCALE_BY_LANGUAGE[language], {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const mapSessionRow = (row: unknown): ChatSession | null => {
  if (!isRecord(row)) return null;

  const id = toStringOrNull(row.id);
  if (!id) return null;

  return {
    id,
    title: toStringOrNull(row.session_title) ?? '',
    subjectId: toStringOrNull(row.subject_id),
    createdAt: toStringOrNull(row.created_at),
    lastActiveAt: toStringOrNull(row.last_active_at),
  };
};

const mapMessageRow = (row: unknown): ChatMessage | null => {
  if (!isRecord(row)) return null;

  const id = toStringOrNull(row.id);
  const content = toStringOrNull(row.content);
  const createdAt = toStringOrNull(row.created_at);

  if (!id || !content) return null;

  return {
    id,
    role: toSafeRole(toStringOrNull(row.role)),
    content,
    status: 'sent',
    createdAt: toTimestamp(createdAt),
  };
};

const fetchChatSessions = async (): Promise<ChatSession[]> => {
  const { data, error } = await supabase
    .from('ai_chat_sessions')
    .select('id, session_title, subject_id, created_at, last_active_at')
    .order('last_active_at', { ascending: false })
    .limit(SESSION_LIMIT);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as AiSessionRow[])
    .map(mapSessionRow)
    .filter((session): session is ChatSession => Boolean(session));
};

const fetchChatMessages = async (sessionId: string): Promise<ChatMessage[]> => {
  const { data, error } = await supabase
    .from('ai_chat_messages')
    .select('id, role, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as AiMessageRow[])
    .map(mapMessageRow)
    .filter((message): message is ChatMessage => Boolean(message));
};

const deleteChatSession = async (sessionId: string): Promise<void> => {
  const { error: messagesError } = await supabase
    .from('ai_chat_messages')
    .delete()
    .eq('session_id', sessionId);

  if (messagesError) {
    throw new Error(messagesError.message);
  }

  const { error: sessionError } = await supabase
    .from('ai_chat_sessions')
    .delete()
    .eq('id', sessionId);

  if (sessionError) {
    throw new Error(sessionError.message);
  }
};

const AIChatPage = () => {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();

  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState<boolean>(true);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [sessionToDelete, setSessionToDelete] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const userInitial = useMemo(() => {
    return user?.email?.trim()?.charAt(0)?.toUpperCase() || 'U';
  }, [user?.email]);

  const {
    data: subjects = [],
    isLoading: isSubjectsLoading,
    isError: isSubjectsError,
    refetch: refetchSubjects,
    isFetching: isSubjectsFetching,
  } = useQuery({
    queryKey: ['aiSubjects'],
    queryFn: fetchAiSubjects,
    staleTime: 1000 * 60 * 60,
    retry: 2,
  });

  const subjectById = useMemo(() => {
    return new Map(subjects.map(subject => [subject.id, subject]));
  }, [subjects]);

  const {
    data: chatSessions = [],
    isLoading: isSessionsLoading,
    isError: isSessionsError,
    refetch: refetchSessions,
    isFetching: isSessionsFetching,
  } = useQuery({
    queryKey: ['aiChatSessions'],
    queryFn: fetchChatSessions,
    enabled: Boolean(user),
    staleTime: 1000 * 30,
    retry: 2,
  });

  const {
    data: loadedMessages = [],
    isLoading: isMessagesLoading,
    isError: isMessagesError,
    refetch: refetchMessages,
    isFetching: isMessagesFetching,
  } = useQuery({
    queryKey: ['aiChatMessages', activeSessionId],
    queryFn: () => fetchChatMessages(activeSessionId as string),
    enabled: Boolean(activeSessionId),
    staleTime: 1000 * 15,
    retry: 2,
  });

  const chatMutation = useMutation({
    mutationFn: (variables: SendMessageVariables) =>
      sendChatMessage({
        message: variables.message,
        subjectId: variables.subjectId,
        sessionId: variables.sessionId,
        lang: language,
      }),
    onSuccess: async (data, variables) => {
      setMessages(prev =>
        prev.map(message =>
          message.id === variables.localMessageId
            ? { ...message, status: 'sent' }
            : message
        )
      );

      setMessages(prev => [
        ...prev,
        {
          id: createId(),
          role: 'assistant',
          content: data.reply || t('ai.noAnswer'),
          status: 'sent',
          createdAt: Date.now(),
        },
      ]);

      if (data.sessionId) {
        setSessionId(data.sessionId);
        setActiveSessionId(data.sessionId);
      }

      await queryClient.invalidateQueries({ queryKey: ['aiChatSessions'] });

      if (data.sessionId) {
        await queryClient.invalidateQueries({
          queryKey: ['aiChatMessages', data.sessionId],
        });
      }
    },
    onError: (error, variables) => {
      setMessages(prev =>
        prev.map(message =>
          message.id === variables.localMessageId
            ? { ...message, status: 'failed' }
            : message
        )
      );

      setMessages(prev => [
        ...prev,
        {
          id: createId(),
          role: 'assistant',
          content: t(getSafeErrorMessage(error)),
          status: 'sent',
          createdAt: Date.now(),
        },
      ]);
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: deleteChatSession,
    onSuccess: async (_, deletedSessionId) => {
      if (activeSessionId === deletedSessionId) {
        setActiveSessionId(null);
        setSessionId(null);
        setMessages([]);
      }

      setSessionToDelete(null);

      await queryClient.invalidateQueries({ queryKey: ['aiChatSessions'] });
      await queryClient.removeQueries({ queryKey: ['aiChatMessages', deletedSessionId] });
    },
  });

  const canSendMessage =
    Boolean(input.trim()) &&
    Boolean(selectedSubject) &&
    !chatMutation.isPending &&
    input.trim().length <= MAX_MESSAGE_LENGTH;

  const remainingCharacters = MAX_MESSAGE_LENGTH - input.length;
  const hasMessages = messages.length > 0;

  const scrollToLatestMessage = useCallback(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, []);

  useEffect(() => {
    scrollToLatestMessage();
  }, [messages, chatMutation.isPending, scrollToLatestMessage]);

  useEffect(() => {
    if (loadedMessages.length > 0 && activeSessionId) {
      setMessages(loadedMessages);
      setSessionId(activeSessionId);
    }
  }, [activeSessionId, loadedMessages]);

  useEffect(() => {
    if (!isSubjectModalOpen && selectedSubject) {
      window.setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isSubjectModalOpen, selectedSubject]);

  useEffect(() => {
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      if (sessionToDelete) {
        setSessionToDelete(null);
        return;
      }

      if (isHistoryOpen) {
        setIsHistoryOpen(false);
        return;
      }

      if (isSubjectModalOpen && selectedSubject) {
        setIsSubjectModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isHistoryOpen, isSubjectModalOpen, selectedSubject, sessionToDelete]);

  const handleSubjectSelect = useCallback(
    (subjectId: string) => {
      const subject = subjects.find(item => item.id === subjectId);

      if (!subject) return;

      const isChangingSubject = selectedSubject?.id !== subject.id;

      setSelectedSubject(subject);
      setIsSubjectModalOpen(false);

      if (isChangingSubject) {
        setActiveSessionId(null);
        setSessionId(null);
        setMessages([]);
      }
    },
    [selectedSubject?.id, subjects]
  );

  const handleOpenSession = useCallback(
    (session: ChatSession) => {
      setActiveSessionId(session.id);
      setSessionId(session.id);
      setInput('');
      setIsHistoryOpen(false);

      if (session.subjectId) {
        const subject = subjectById.get(session.subjectId);
        if (subject) {
          setSelectedSubject(subject);
        }
      }
    },
    [subjectById]
  );

  const handleNewChat = useCallback(() => {
    setActiveSessionId(null);
    setSessionId(null);
    setMessages([]);
    setInput('');
    setIsHistoryOpen(false);
    setIsSubjectModalOpen(true);
  }, []);

  const submitMessage = useCallback(
    (messageText: string, retryMessageId?: string) => {
      const trimmedMessage = messageText.trim();

      if (!trimmedMessage || !selectedSubject || chatMutation.isPending) return;
      if (trimmedMessage.length > MAX_MESSAGE_LENGTH) return;

      const localMessageId = retryMessageId || createId();

      if (retryMessageId) {
        setMessages(prev =>
          prev.map(message =>
            message.id === retryMessageId
              ? {
                  ...message,
                  status: 'sending',
                  createdAt: Date.now(),
                }
              : message
          )
        );
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: localMessageId,
            role: 'user',
            content: trimmedMessage,
            status: 'sending',
            createdAt: Date.now(),
          },
        ]);
        setInput('');
      }

      chatMutation.mutate({
        localMessageId,
        message: trimmedMessage,
        subjectId: selectedSubject.id,
        sessionId,
      });
    },
    [chatMutation, selectedSubject, sessionId]
  );

  const handleSendMessage = useCallback(
    (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      submitMessage(input);
    },
    [input, submitMessage]
  );

  const handleRetryMessage = useCallback(
    (message: ChatMessage) => {
      if (message.role !== 'user' || message.status !== 'failed') return;
      submitMessage(message.content, message.id);
    },
    [submitMessage]
  );

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleDeleteCurrentSession = useCallback(() => {
    if (!sessionToDelete || deleteSessionMutation.isPending) return;
    deleteSessionMutation.mutate(sessionToDelete.id);
  }, [deleteSessionMutation, sessionToDelete]);

  return (
    <div className="relative flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden bg-app font-sans text-text-primary">
      {isSubjectModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-app/80 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-subject-modal-title"
        >
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border-color bg-surface-elevated shadow-2xl">
            <div className="p-6 sm:p-8">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="h-8 w-8" aria-hidden="true" />
              </div>

              <div className="mb-8 text-center">
                <h2 id="ai-subject-modal-title" className="text-2xl font-bold text-text-primary">
                  {t('ai.brand')}
                </h2>
                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  {t('ai.selectSubjectHint')}
                </p>
              </div>

              {isSubjectsError ? (
                <div className="rounded-2xl border border-border-color bg-surface p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold text-text-primary">
                        {t('ai.subjectsLoadError')}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-text-secondary">
                        {t('ai.subjectsLoadErrorHint')}
                      </p>
                      <button
                        type="button"
                        onClick={() => void refetchSubjects()}
                        disabled={isSubjectsFetching}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSubjectsFetching ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                        )}
                        {t('common.retry')}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label htmlFor="ai-subject-select" className="mb-2 block text-sm font-semibold text-text-primary">
                    {t('ai.selectSubject')}
                  </label>

                  <div className="relative">
                    <select
                      id="ai-subject-select"
                      onChange={event => handleSubjectSelect(event.target.value)}
                      className="w-full cursor-pointer appearance-none rounded-2xl border border-input-border bg-input-bg px-5 py-4 pr-11 text-text-primary transition focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
                      value={selectedSubject?.id || ''}
                      disabled={isSubjectsLoading}
                    >
                      <option value="" disabled>
                        {isSubjectsLoading ? t('ai.subjectsLoading') : t('ai.chooseSubjectPlaceholder')}
                      </option>

                      {subjects.map(subject => (
                        <option key={subject.id} value={subject.id}>
                          {pickLang(language, subject.name_bn, subject.name_en)}
                        </option>
                      ))}
                    </select>

                    <ChevronDown
                      className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-secondary"
                      aria-hidden="true"
                    />
                  </div>

                  {subjects.length === 0 && !isSubjectsLoading && (
                    <p className="mt-3 text-sm text-text-secondary">
                      {t('ai.noSubjects')}
                    </p>
                  )}
                </div>
              )}

              {selectedSubject && (
                <button
                  type="button"
                  onClick={() => setIsSubjectModalOpen(false)}
                  className="mt-6 w-full rounded-2xl border border-border-color bg-secondary px-4 py-3 text-sm font-semibold text-text-primary transition active:scale-[0.99]"
                >
                  {t('ai.continueWithPrevious')}
                </button>
              )}
            </div>

            <div className="flex items-start gap-2 border-t border-border-color bg-surface p-4">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
              <p className="text-xs leading-5 text-text-secondary">
                {t('ai.subjectDisclaimer')}
              </p>
            </div>
          </div>
        </div>
      )}

      {isHistoryOpen && (
        <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-labelledby="ai-history-title">
          <button
            type="button"
            aria-label={t('ai.closeHistoryAria')}
            className="absolute inset-0 bg-app/75 backdrop-blur-sm"
            onClick={() => setIsHistoryOpen(false)}
          />

          <aside className="absolute bottom-0 left-0 top-0 flex w-[86%] max-w-sm flex-col border-r border-border-color bg-surface-elevated shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-color p-4">
              <div>
                <h2 id="ai-history-title" className="text-lg font-bold text-text-primary">
                  {t('ai.historyTitle')}
                </h2>
                <p className="text-xs text-text-secondary">
                  {t('ai.historySubtitle')}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                aria-label={t('ai.closeHistoryAria')}
                className="rounded-2xl p-2 text-text-secondary transition hover:bg-secondary"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="border-b border-border-color p-4">
              <button
                type="button"
                onClick={handleNewChat}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.99]"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                {t('ai.newChat')}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {isSessionsLoading ? (
                <div className="space-y-3 p-1">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="rounded-2xl border border-border-color bg-surface p-4">
                      <div className="h-3 w-3/4 animate-pulse rounded-full bg-secondary" />
                      <div className="mt-3 h-2 w-1/2 animate-pulse rounded-full bg-secondary" />
                    </div>
                  ))}
                </div>
              ) : isSessionsError ? (
                <div className="rounded-2xl border border-border-color bg-surface p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold text-text-primary">
                        {t('ai.historyLoadError')}
                      </p>
                      <button
                        type="button"
                        onClick={() => void refetchSessions()}
                        disabled={isSessionsFetching}
                        className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary disabled:opacity-60"
                      >
                        {isSessionsFetching && (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        )}
                        {t('common.retry')}
                      </button>
                    </div>
                  </div>
                </div>
              ) : chatSessions.length === 0 ? (
                <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-border-color bg-surface p-6 text-center">
                  <History className="mb-3 h-8 w-8 text-text-secondary" aria-hidden="true" />
                  <p className="text-sm font-semibold text-text-primary">
                    {t('ai.noChats')}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-text-secondary">
                    {t('ai.noChatsHint')}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {chatSessions.map(session => {
                    const subjectName = session.subjectId
                      ? pickLang(language, subjectById.get(session.subjectId)?.name_bn ?? null, subjectById.get(session.subjectId)?.name_en ?? null)
                      : null;

                    const isActive = activeSessionId === session.id;

                    return (
                      <div
                        key={session.id}
                        className={`group rounded-2xl border p-3 transition ${
                          isActive
                            ? 'border-primary bg-primary/10'
                            : 'border-border-color bg-surface hover:bg-secondary'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleOpenSession(session)}
                          className="w-full text-left"
                        >
                          <p className="line-clamp-2 text-sm font-semibold text-text-primary">
                            {session.title || t('ai.newChatTitle')}
                          </p>
                          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-text-secondary">
                            <span className="truncate">
                              {subjectName || t('ai.noSubject')}
                            </span>
                            <span className="shrink-0">
                              {formatSessionDate(session.lastActiveAt, language)}
                            </span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSessionToDelete(session)}
                          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent opacity-80 transition hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          {t('ai.delete')}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {sessionToDelete && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-app/80 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-session-title"
        >
          <div className="w-full max-w-sm rounded-3xl border border-border-color bg-surface-elevated p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="delete-session-title" className="text-lg font-bold text-text-primary">
                  {t('ai.deleteConfirmTitle')}
                </h2>
                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  {t('ai.deleteConfirmBody', { title: sessionToDelete.title || t('ai.newChatTitle') })}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSessionToDelete(null)}
                aria-label={t('ai.closeDeleteAria')}
                className="rounded-full p-2 text-text-secondary transition hover:bg-secondary"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {deleteSessionMutation.isError && (
              <div className="mb-4 rounded-2xl border border-border-color bg-surface p-3 text-sm text-accent">
                {t('ai.deleteError')}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setSessionToDelete(null)}
                disabled={deleteSessionMutation.isPending}
                className="flex-1 rounded-2xl border border-border-color bg-secondary px-4 py-3 text-sm font-semibold text-text-primary transition active:scale-[0.99] disabled:opacity-60"
              >
                {t('common.cancel')}
              </button>

              <button
                type="button"
                onClick={handleDeleteCurrentSession}
                disabled={deleteSessionMutation.isPending}
                className="flex-1 rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.99] disabled:opacity-60"
              >
                {deleteSessionMutation.isPending ? t('ai.deleting') : t('ai.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-20 border-b border-border-color bg-nav-bg/90 px-4 py-3 text-nav-text backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setIsHistoryOpen(true)}
              aria-label={t('ai.openHistoryAria')}
              className="rounded-2xl p-2.5 text-text-secondary transition hover:bg-secondary active:scale-95"
            >
              <History className="h-5 w-5" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => setIsSubjectModalOpen(true)}
              aria-label={t('ai.chooseSubjectAria')}
              className="min-w-0 rounded-2xl border border-border-color bg-secondary px-3 py-2 text-text-primary transition active:scale-[0.99]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate text-sm font-semibold">
                  {pickLang(language, selectedSubject?.name_bn ?? null, selectedSubject?.name_en ?? null) || t('ai.selectSubjectShort')}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleNewChat}
              aria-label={t('ai.startNewChatAria')}
              className="rounded-2xl p-2.5 text-text-secondary transition hover:bg-secondary active:scale-95"
            >
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
            </button>

            <div
              aria-label={t('ai.userAria')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
            >
              {userInitial}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-44 pt-6 sm:px-6">
        <div className="mx-auto max-w-4xl space-y-7">
          {isMessagesLoading && activeSessionId ? (
            <div className="space-y-5 pt-8">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex gap-4">
                  <div className="h-9 w-9 animate-pulse rounded-xl bg-surface" />
                  <div className="w-full max-w-md rounded-2xl border border-border-color bg-surface p-4">
                    <div className="h-2.5 w-3/4 animate-pulse rounded-full bg-secondary" />
                    <div className="mt-3 h-2.5 w-1/2 animate-pulse rounded-full bg-secondary" />
                  </div>
                </div>
              ))}
            </div>
          ) : isMessagesError && activeSessionId ? (
            <div className="flex min-h-[55dvh] items-center justify-center">
              <div className="max-w-sm rounded-3xl border border-border-color bg-surface p-6 text-center">
                <AlertCircle className="mx-auto mb-3 h-9 w-9 text-accent" aria-hidden="true" />
                <h1 className="text-lg font-bold text-text-primary">
                  {t('ai.messagesLoadError')}
                </h1>
                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  {t('ai.messagesLoadErrorHint')}
                </p>
                <button
                  type="button"
                  onClick={() => void refetchMessages()}
                  disabled={isMessagesFetching}
                  className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {isMessagesFetching && (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  )}
                  {t('common.retry')}
                </button>
              </div>
            </div>
          ) : !hasMessages ? (
            <section className="flex min-h-[55dvh] flex-col items-center justify-center text-center">
              <div className="mb-6 flex h-20 w-20 rotate-3 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-xl">
                <Sparkles className="h-10 w-10" aria-hidden="true" />
              </div>

              <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">
                {t('ai.greeting')}
              </h1>

              <p className="mt-3 max-w-md text-sm leading-7 text-text-secondary">
                {selectedSubject
                  ? t('ai.welcomeWithSubject', { subject: pickLang(language, selectedSubject.name_bn, selectedSubject.name_en) })
                  : t('ai.welcomeNoSubject')}
              </p>

              {!selectedSubject && (
                <button
                  type="button"
                  onClick={() => setIsSubjectModalOpen(true)}
                  className="mt-6 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.99]"
                >
                  {t('ai.selectSubject')}
                </button>
              )}
            </section>
          ) : (
            messages.map(message => {
              const isUserMessage = message.role === 'user';

              return (
                <article
                  key={message.id}
                  className={`flex gap-3 sm:gap-5 ${isUserMessage ? 'flex-row-reverse' : ''}`}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm ${
                      isUserMessage
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border-color bg-surface text-text-secondary'
                    }`}
                    aria-hidden="true"
                  >
                    {isUserMessage ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                  </div>

                  <div className={`flex max-w-[86%] flex-col ${isUserMessage ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`rounded-2xl px-4 py-3 text-[15px] leading-7 shadow-sm ${
                        isUserMessage
                          ? 'rounded-tr-none bg-primary text-primary-foreground'
                          : 'rounded-tl-none border border-border-color bg-surface text-text-primary'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    </div>

                    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-text-secondary">
                      <span>{formatTime(message.createdAt, language)}</span>

                      {message.status === 'sending' && (
                        <span className="inline-flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                          {t('ai.sending')}
                        </span>
                      )}

                      {message.status === 'failed' && (
                        <span className="inline-flex items-center gap-2 text-accent">
                          {t('ai.sendFailed')}
                          <button
                            type="button"
                            onClick={() => handleRetryMessage(message)}
                            disabled={chatMutation.isPending}
                            className="font-semibold underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {t('ai.resend')}
                          </button>
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}

          {chatMutation.isPending && (
            <div className="flex gap-3 sm:gap-5" aria-label={t('ai.generatingAria')}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border-color bg-surface text-text-secondary">
                <Bot className="h-5 w-5" aria-hidden="true" />
              </div>

              <div className="w-full max-w-sm rounded-2xl border border-border-color bg-surface p-4">
                <div className="space-y-3">
                  <div className="h-2.5 w-3/4 animate-pulse rounded-full bg-secondary" />
                  <div className="h-2.5 w-1/2 animate-pulse rounded-full bg-secondary" />
                </div>
              </div>
            </div>
          )}

          <div ref={scrollRef} className="h-1" />
        </div>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-30 bg-app/90 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 backdrop-blur-md sm:px-6 sm:pb-6">
        <div className="mx-auto max-w-4xl">
          {!selectedSubject && (
            <div className="mb-3 rounded-2xl border border-border-color bg-surface px-4 py-3 text-sm text-text-secondary">
              {t('ai.selectSubjectFirst')}
            </div>
          )}

          <form
            onSubmit={handleSendMessage}
            className="flex items-center gap-2 rounded-[1.75rem] border border-border-color bg-surface-elevated px-4 py-2 shadow-lg transition focus-within:ring-2 focus-within:ring-focus-ring"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={event => setInput(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
              onKeyDown={handleInputKeyDown}
              placeholder={
                selectedSubject
                  ? t('ai.inputPlaceholderSubject', { subject: pickLang(language, selectedSubject.name_bn, selectedSubject.name_en) })
                  : t('ai.inputPlaceholder')
              }
              disabled={!selectedSubject || chatMutation.isPending}
              className="min-w-0 flex-1 border-none bg-transparent py-3 text-text-primary placeholder:text-text-secondary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              autoComplete="off"
              aria-label={t('ai.inputAria')}
            />

            <button
              type="submit"
              disabled={!canSendMessage}
              aria-label={t('ai.sendAria')}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition active:scale-95 disabled:cursor-not-allowed disabled:bg-secondary disabled:text-text-secondary"
            >
              {chatMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </form>

          <div className="mt-2 flex items-center justify-between gap-3 px-1">
            <p className="text-[10px] leading-4 text-text-secondary">
              {t('ai.aiDisclaimer')}
            </p>

            <span
              className={`shrink-0 text-[10px] ${
                remainingCharacters < 80 ? 'text-accent' : 'text-text-secondary'
              }`}
            >
              {remainingCharacters}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AIChatPage;
