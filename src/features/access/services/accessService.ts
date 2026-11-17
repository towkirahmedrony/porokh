import apiClient from '@/shared/lib/apiClient';
import type { AccessPayload } from '../types';

/** Maximum time access data may be reused before it is considered stale. */
export const ACCESS_STALE_TIME_MS = 30_000;

const emptyPayload = (): AccessPayload => ({ access: null, features: [] });

export const accessService = {
  /**
   * Authoritative access state for the signed-in user. The server resolves the
   * identity from the bearer token, so no user id is ever sent.
   */
  async fetchMyAccess(): Promise<AccessPayload> {
    const response = await apiClient.get('/me/access');
    const payload = response.data?.data ?? response.data ?? null;

    if (!payload || typeof payload !== 'object') return emptyPayload();

    const access = (payload.access ?? null) as AccessPayload['access'];
    const features = Array.isArray(payload.features) ? payload.features : [];

    return { access, features };
  },
};

export default accessService;
