import apiClient from '@/shared/lib/apiClient';
import type {
  DismissedMistake,
  ExplorerFacetResponse,
  ExplorerFilters,
  ExplorerPage,
  ExplorerSort,
  ExplorerSource,
} from '../types/explorer';

type Envelope<T> = { data?: T };

const unwrap = <T,>(payload: unknown): T => {
  const envelope = payload as Envelope<T> | null;
  if (envelope && typeof envelope === 'object' && 'data' in envelope) {
    return envelope.data as T;
  }
  return payload as T;
};

const filtersParam = (filters: ExplorerFilters): string | undefined => {
  const entries = Object.entries(filters).filter(
    ([, value]) => value !== undefined && value !== null && value !== ''
  );
  return entries.length === 0 ? undefined : JSON.stringify(Object.fromEntries(entries));
};

export const explorerService = {
  async getPage(params: {
    source: ExplorerSource;
    filters: ExplorerFilters;
    sort: ExplorerSort;
    limit?: number;
    offset?: number;
  }): Promise<ExplorerPage> {
    const { data } = await apiClient.get('/history/explorer', {
      params: {
        source: params.source,
        filters: filtersParam(params.filters),
        sort: params.sort,
        limit: params.limit ?? 20,
        offset: params.offset ?? 0,
      },
    });

    const payload = unwrap<ExplorerPage>(data);
    const items = Array.isArray(payload?.items) ? payload.items : [];

    return {
      items,
      total: Math.max(0, Number(payload?.total ?? items.length) || 0),
      limit: Number(payload?.limit ?? 20) || 20,
      offset: Math.max(0, Number(payload?.offset ?? 0) || 0),
      has_more: Boolean(payload?.has_more),
    };
  },

  async getFacets(
    source: ExplorerSource,
    filters: ExplorerFilters
  ): Promise<ExplorerFacetResponse> {
    const { data } = await apiClient.get('/history/explorer/facets', {
      params: { source, filters: filtersParam(filters) },
    });

    const payload = unwrap<{ facets?: ExplorerFacetResponse['facets']; counts?: ExplorerFacetResponse['counts'] }>(data);

    return {
      facets: payload?.facets ?? {},
      counts: payload?.counts ?? {},
    };
  },

  async getCount(source: ExplorerSource, filters: ExplorerFilters): Promise<number> {
    const { data } = await apiClient.get('/history/explorer/count', {
      params: { source, filters: filtersParam(filters) },
    });

    const payload = unwrap<{ available_count?: number }>(data);
    const count = Number(payload?.available_count ?? 0);
    return Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0;
  },

  async startPractice(params: {
    source: ExplorerSource;
    filters: ExplorerFilters;
    count: number;
    confirmReduced?: boolean;
  }) {
    const { data } = await apiClient.post('/history/explorer/practice', {
      source: params.source,
      filters: params.filters,
      count: params.count,
      confirm_reduced: params.confirmReduced === true,
    });

    return unwrap<{
      started: boolean;
      reason?: 'empty' | 'confirm_partial' | 'confirm_reduced';
      available_count: number;
      total_count: number;
      attempt?: { id: string };
    }>(data);
  },

  async dismissMistake(questionId: string): Promise<void> {
    await apiClient.delete(`/history/mistakes/${encodeURIComponent(questionId)}`);
  },

  async restoreMistakes(questionIds: string[]): Promise<number> {
    const { data } = await apiClient.post('/history/mistakes/restore', {
      question_ids: questionIds,
    });
    const payload = unwrap<{ restored?: number }>(data);
    return Math.max(0, Number(payload?.restored ?? 0) || 0);
  },

  async getDismissed(): Promise<DismissedMistake[]> {
    const { data } = await apiClient.get('/history/mistakes/dismissed');
    const payload = unwrap<DismissedMistake[]>(data);
    return Array.isArray(payload) ? payload : [];
  },

  async removeBookmark(bookmarkId: string): Promise<void> {
    await apiClient.delete(`/history/bookmarks/${encodeURIComponent(bookmarkId)}`);
  },

  async addBookmark(questionId: string, note?: string | null): Promise<void> {
    await apiClient.post('/history/bookmarks', {
      question_id: questionId,
      note: note ?? null,
    });
  },

  async updateNote(bookmarkId: string, note: string): Promise<{ id: string; note: string | null }> {
    const { data } = await apiClient.patch(
      `/history/bookmarks/${encodeURIComponent(bookmarkId)}`,
      { note }
    );
    return unwrap<{ id: string; note: string | null }>(data);
  },
};

export default explorerService;
