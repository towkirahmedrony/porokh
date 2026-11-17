import axios from 'axios';
import { apiClient } from '@/shared/lib/apiClient';
import {
  SupportListParams,
  SupportTicketDetail,
  SupportTicketDraft,
  SupportTicketList,
} from '../types/supportTypes';

interface ApiEnvelope<T> {
  data?: T;
}

const unwrap = <T>(payload: ApiEnvelope<T> | T): T => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as ApiEnvelope<T>).data as T;
  }

  return payload as T;
};

export const fetchSupportTickets = async (
  params: SupportListParams = {}
): Promise<SupportTicketList> => {
  const response = await apiClient.get<ApiEnvelope<SupportTicketList>>('/support', {
    params,
  });

  return (
    unwrap(response.data) ?? { items: [], total: 0, limit: 20, offset: 0 }
  );
};

export const fetchSupportTicket = async (
  ticketId: string
): Promise<SupportTicketDetail> => {
  const response = await apiClient.get<ApiEnvelope<SupportTicketDetail>>(
    `/support/${ticketId}`
  );

  return unwrap(response.data);
};

export const createSupportTicket = async (
  draft: SupportTicketDraft
): Promise<SupportTicketDetail> => {
  const response = await apiClient.post<ApiEnvelope<SupportTicketDetail>>(
    '/support',
    draft
  );

  return unwrap(response.data);
};

export const replyToSupportTicket = async (
  ticketId: string,
  body: string
): Promise<SupportTicketDetail> => {
  const response = await apiClient.post<ApiEnvelope<SupportTicketDetail>>(
    `/support/${ticketId}/replies`,
    { body }
  );

  return unwrap(response.data);
};

export const reopenSupportTicket = async (
  ticketId: string
): Promise<SupportTicketDetail> => {
  const response = await apiClient.post<ApiEnvelope<SupportTicketDetail>>(
    `/support/${ticketId}/reopen`
  );

  return unwrap(response.data);
};

export interface SupportApiError {
  code: string | null;
  message: string | null;
  ticketId: string | null;
}

/**
 * Normalizes the API error envelope so screens can branch on the stable code
 * (`DUPLICATE_TICKET`, `TICKET_CLOSED`) without inspecting axios internals.
 */
export const getSupportApiError = (error: unknown): SupportApiError => {
  if (!axios.isAxiosError(error)) {
    return { code: null, message: null, ticketId: null };
  }

  const payload = error.response?.data as
    | { code?: string; message?: string; details?: { ticket_id?: string } }
    | undefined;

  return {
    code: payload?.code ?? null,
    message: payload?.message ?? null,
    ticketId: payload?.details?.ticket_id ?? null,
  };
};
