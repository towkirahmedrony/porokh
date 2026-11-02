import axios, { InternalAxiosRequestConfig, AxiosError, AxiosResponse } from 'axios';
import { supabase } from './supabase';
import { getDeviceId } from '../utils/device';
import { getNativeVersion } from '../utils/nativeVersion';
import { API_BASE_URL } from './apiConfig';
import { formatNetworkDiagnostic } from './networkDiagnostics';

const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000, 
  headers: {
    'Content-Type': 'application/json',
    'x-app-version': APP_VERSION,
  },
});

/**
 * Request Interceptor: Auto inject Supabase session token & Device ID
 */
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      if (config.headers) {
        config.headers['x-device-id'] = getDeviceId();
        // Only present inside the Android shell; lets the API enforce the
        // minimum supported APK version server-side as well.
        const nativeVersion = await getNativeVersion();
        if (nativeVersion) config.headers['x-native-version'] = nativeVersion;
      }

      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error && import.meta.env.DEV) {
        // 👈 প্রোডাকশনে কনসোল এরর হাইড করা হলো
        console.warn('Supabase session fetch error:', error.message);
      }
      
      if (session?.access_token && config.headers) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        // 👈 Typo ফিক্স এবং Dev Check
        console.error('Auth interceptor error:', error);
      }
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor: Handle global errors like 401 Unauthorized
 */
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    const accessPayload = error.response?.data as
      | { code?: string; details?: Record<string, unknown> }
      | undefined;
    const accessCode = accessPayload?.code;

    // Metered and premium rejections are surfaced app-wide so any screen can
    // open the correct paywall state without duplicating error parsing.
    if (
      error.response?.status === 403 &&
      (accessCode === 'FREE_LIMIT_REACHED' || accessCode === 'PREMIUM_REQUIRED')
    ) {
      window.dispatchEvent(
        new CustomEvent('access:error', {
          detail: { code: accessCode, details: accessPayload?.details ?? null },
        })
      );
    }

    if (error.response?.status === 403 && accessCode === 'ACCOUNT_SUSPENDED') {
      window.dispatchEvent(new CustomEvent('auth:suspended'));
    }

    if (!error.response && import.meta.env.DEV) {
      console.warn('[api:network]', formatNetworkDiagnostic({ url: error.config?.url, method: error.config?.method }));
    }

    if (error.response?.status === 401) {
      if (import.meta.env.DEV) {
        console.warn('Unauthorized request. Dispatching logout event.');
      }
      // Dispatch a custom event so the app (e.g., AuthProvider) can listen and force logout
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export { apiClient };
export default apiClient;
