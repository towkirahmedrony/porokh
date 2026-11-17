import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  createSupportTicket,
  fetchSupportTicket,
  fetchSupportTickets,
  reopenSupportTicket,
  replyToSupportTicket,
} from '../services/supportService';
import { SupportListParams, SupportTicketDraft } from '../types/supportTypes';

export const supportKeys = {
  all: ['support'] as const,
  list: (userId: string | undefined, params: SupportListParams) =>
    ['support', 'list', userId, params] as const,
  detail: (userId: string | undefined, ticketId: string) =>
    ['support', 'detail', userId, ticketId] as const,
};

const ACTIVE_POLL_MS = 30_000;

export const useSupportTickets = (params: SupportListParams) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: supportKeys.list(user?.id, params),
    queryFn: () => fetchSupportTickets(params),
    enabled: Boolean(user?.id),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
};

export const useSupportTicket = (ticketId: string | undefined) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: supportKeys.detail(user?.id, ticketId ?? ''),
    queryFn: () => fetchSupportTicket(ticketId as string),
    enabled: Boolean(user?.id && ticketId),
    staleTime: 15 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const status = query.state.data?.ticket.status;
      return status === 'closed' || status === 'resolved' ? false : ACTIVE_POLL_MS;
    },
  });
};

export const useCreateSupportTicket = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (draft: SupportTicketDraft) => createSupportTicket(draft),
    onSuccess: (detail) => {
      queryClient.setQueryData(
        supportKeys.detail(user?.id, detail.ticket.id),
        detail
      );
      void queryClient.invalidateQueries({ queryKey: supportKeys.all });
    },
  });
};

export const useReplyToSupportTicket = (ticketId: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: string) => replyToSupportTicket(ticketId, body),
    onSuccess: (detail) => {
      queryClient.setQueryData(supportKeys.detail(user?.id, ticketId), detail);
      void queryClient.invalidateQueries({ queryKey: supportKeys.all });
    },
  });
};

export const useReopenSupportTicket = (ticketId: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => reopenSupportTicket(ticketId),
    onSuccess: (detail) => {
      queryClient.setQueryData(supportKeys.detail(user?.id, ticketId), detail);
      void queryClient.invalidateQueries({ queryKey: supportKeys.all });
    },
  });
};
