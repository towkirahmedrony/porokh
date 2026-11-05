export const STORAGE_KEYS = {
  THEME: 'app_theme',
  LANGUAGE: 'app_language',
  ONBOARDING_SEEN: 'onboarding_seen',
  SIGNUP_PENDING_VERIFICATION: 'porokh_pending_verification_email',
  SIGNUP_VERIFY_RESEND_AT: 'porokh_verification_resend_at',
  SIGNUP_ONBOARDING_DRAFT_PREFIX: 'porokh_onboarding_draft_',
  SIDEBAR_COLLAPSED: 'sidebar_collapsed',
  // Kept stable on purpose: the stored device id is sent to the backend as
  // x-device-id, and in-progress exam data must survive the rebrand.
  DEVICE_ID: 'parapoth_device_id', // 👈 Updated for precise isolated tracking
  EXAM_PROGRESS_PREFIX: 'parapoth_exam_progress_',
  DAILY_QUOTE: 'daily_greeting_quote',
  USER_FULL_NAME: 'user_full_name',
  DYN_THEME_CONFIG: 'dyn_theme_config',
  DYN_THEME: 'dyn_theme',
  DISMISSED_NOTICE: 'dismissed_global_notice',
  // In-app "disable on this device" choice; survives a restart so the next
  // launch does not silently re-register the phone.
  NATIVE_PUSH_DISABLED: 'porokh_native_push_disabled',
  // The first-launch permission dialog is asked once per install, not on every
  // launch, so an ignored prompt never becomes a recurring modal.
  NATIVE_PUSH_ASKED: 'porokh_native_push_asked',
  // Optional update prompt, dismissed per target version.
  DISMISSED_UPDATE: 'dismissed_optional_update',
  HOME_GRIDS_DATA: 'home_grids_data',
  REACT_QUERY_CACHE: 'POROKH_QUERY_CACHE',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

export const LOCAL_STORAGE_SYNC_EVENT = 'local-storage-sync';

// --- QUERY KEYS ---
export const QUERY_KEYS = {
  USER_PROFILE: ['userProfile', 'me'] as const,
  PUBLIC_PROFILE: (targetId: string) => ['publicProfile', targetId] as const,
  DAILY_QUOTE: ['dailyQuote'] as const,
  STREAK_STATS: ['streak', 'stats'] as const,
  STREAK_HEATMAP: ['streak', 'heatmap'] as const,
  HOME_GRIDS: ['homeGrids'] as const,
  SYSTEM_CONFIGS: ['system-configs'] as const,
} as const;

// --- API ENDPOINTS ---
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: 'secure-login',
  },
} as const;
