import type { AppLanguage } from '@/shared/i18n/messages';

type LocalizedCopy = { bn: string; en: string };

const COPY: Record<string, LocalizedCopy> = {
  GROUP_FULL: { bn: 'গ্রুপটি পূর্ণ হয়ে গেছে', en: 'This group is full' },
  ALREADY_IN_SQUAD: { bn: 'আপনি ইতোমধ্যে একটি স্কোয়াডে আছেন', en: 'You are already in a squad' },
  ALREADY_MEMBER: { bn: 'আপনি এই গ্রুপের সদস্য', en: 'You are already a member of this group' },
  REQUEST_PENDING: {
    bn: 'আপনার অনুরোধ অনুমোদনের অপেক্ষায় আছে',
    en: 'Your request is awaiting approval',
  },
  BANNED: { bn: 'আপনাকে এই গ্রুপ থেকে নিষিদ্ধ করা হয়েছে', en: 'You are banned from this group' },
  INVALID_JOIN_CODE: { bn: 'জয়েন কোডটি সঠিক নয়', en: 'The join code is not valid' },
  GROUP_NOT_FOUND: { bn: 'গ্রুপটি পাওয়া যায়নি', en: 'Group not found' },
  GROUP_INACTIVE: { bn: 'গ্রুপটি পাওয়া যায়নি', en: 'Group not found' },
  FORBIDDEN: { bn: 'এই কাজের অনুমতি নেই', en: 'You do not have permission for this action' },
  COMMUNITY_ADMIN_ONLY: {
    bn: 'কমিউনিটি শুধু অ্যাডমিন তৈরি করতে পারেন',
    en: 'Only platform admins can create communities',
  },
  INVALID_NAME: { bn: 'নাম ২-৫০ অক্ষরের হতে হবে', en: 'The name must be 2-50 characters' },
  NOT_A_MEMBER: { bn: 'আপনি এই গ্রুপের সদস্য নন', en: 'You are not a member of this group' },
  CANNOT_KICK_OWNER: { bn: 'মালিককে বের করা যাবে না', en: 'The owner cannot be removed' },
  REQUEST_NOT_FOUND: { bn: 'অনুরোধটি পাওয়া যায়নি', en: 'The request was not found' },
  INVALID_MAX_MEMBERS: { bn: 'সদস্য সীমা সঠিক নয়', en: 'The member limit is not valid' },
  INVALID_SLUG: {
    bn: 'লিংকটি সঠিক নয়। ৩-৪০ অক্ষরের ছোট হাতের ইংরেজি, সংখ্যা ও হাইফেন ব্যবহার করুন।',
    en: 'The link is not valid. Use 3-40 lowercase letters, numbers and hyphens.',
  },
  SLUG_TAKEN: { bn: 'এই লিংকটি আগেই ব্যবহার করা হয়েছে', en: 'That link is already taken' },
  INVALID_GROUP_TYPE: { bn: 'গ্রুপের ধরন সঠিক নয়', en: 'The group type is not valid' },
  INVALID_VISIBILITY: { bn: 'দৃশ্যমানতা সঠিক নয়', en: 'The visibility setting is not valid' },
  USE_LEAVE_GROUP: {
    bn: 'মালিক গ্রুপ ছাড়তে চাইলে গ্রুপ ভেঙে দিন',
    en: 'The owner must disband the group instead of leaving',
  },
  MESSAGE_NOT_FOUND: { bn: 'বার্তাটি পাওয়া যায়নি', en: 'The message was not found' },
  CANNOT_REPORT_THIS_MESSAGE: {
    bn: 'নিজের বা সিস্টেম বার্তা রিপোর্ট করা যায় না',
    en: 'You cannot report your own or a system message',
  },
  INVALID_OFFENSE_TYPE: { bn: 'রিপোর্টের ধরন সঠিক নয়', en: 'The report type is not valid' },
  BATTLE_NOT_FOUND: { bn: 'ব্যাটলটি পাওয়া যায়নি', en: 'The battle was not found' },
  CODE_GENERATION_FAILED: {
    bn: 'জয়েন কোড তৈরি করা যায়নি, আবার চেষ্টা করুন',
    en: 'Could not generate a join code. Please try again.',
  },
  PROTECTED_FIELD: { bn: 'এই তথ্য পরিবর্তন করা যাবে না', en: 'This field cannot be changed' },
  BATTLE_ALREADY_OPEN: { bn: 'একটি ব্যাটল আগে থেকেই চলছে', en: 'A battle is already open' },
  BATTLE_CLOSED: { bn: 'ব্যাটলের সময় শেষ', en: 'The battle window has closed' },
  BATTLE_NOT_STARTED: { bn: 'ব্যাটল এখনো শুরু হয়নি', en: 'The battle has not started yet' },
  BATTLE_NOT_FINISHED: { bn: 'ব্যাটল এখনো শেষ হয়নি', en: 'The battle has not finished yet' },
  BATTLE_CANCELLED: { bn: 'ব্যাটল বাতিল হয়েছে', en: 'The battle was cancelled' },
  NOT_JOINED_OR_ALREADY_SUBMITTED: {
    bn: 'আপনি জয়েন করেননি বা আগেই জমা দিয়েছেন',
    en: 'You did not join or have already submitted',
  },
  INVALID_QUESTIONS: { bn: 'ব্যাটলের তথ্য সঠিক নয়', en: 'The battle settings are not valid' },
  INVALID_DURATION: { bn: 'ব্যাটলের তথ্য সঠিক নয়', en: 'The battle settings are not valid' },
  INVALID_START_TIME: { bn: 'ব্যাটলের তথ্য সঠিক নয়', en: 'The battle settings are not valid' },
  AUTH_REQUIRED: { bn: 'আবার লগইন করুন', en: 'Please sign in again' },
  MESSAGE_BLOCKED: {
    bn: 'বার্তাটি পাঠানো যায়নি। লিংক বা নিষিদ্ধ শব্দ থাকতে পারে।',
    en: 'The message was blocked. It may contain a link or a disallowed word.',
  },
  MESSAGE_RATE_LIMITED: {
    bn: 'খুব দ্রুত বার্তা পাঠাচ্ছেন, একটু অপেক্ষা করুন',
    en: 'You are sending messages too quickly. Please slow down.',
  },
  VALIDATION_FAILED: { bn: 'তথ্যটি সঠিক নয়', en: 'Some information is not valid' },
  CRON_UNAUTHORIZED: { bn: 'অনুমতি নেই', en: 'Not authorized' },
};

const GENERIC: LocalizedCopy = {
  bn: 'কিছু ভুল হয়েছে, আবার চেষ্টা করুন',
  en: 'Something went wrong. Please try again.',
};

export const isGroupErrorCode = (value: unknown): value is string =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(COPY, value.trim());

export const getGroupErrorMessage = (code: string | null | undefined, language: AppLanguage): string => {
  const normalized = typeof code === 'string' ? code.trim() : '';
  const copy = COPY[normalized] ?? GENERIC;
  return copy[language] ?? copy.bn;
};

type AxiosLikeError = {
  response?: { status?: number; data?: { code?: unknown; message?: unknown } };
  message?: unknown;
};

/**
 * Central error-code -> localized message mapper used by every group action.
 * The backend forwards the RPC code both as `code` and as `message`, so either
 * one is accepted.
 */
export const resolveGroupErrorMessage = (error: unknown, language: AppLanguage): string => {
  const candidate = error as AxiosLikeError;
  const payloadCode = candidate?.response?.data?.code;
  const payloadMessage = candidate?.response?.data?.message;
  const code = isGroupErrorCode(payloadCode)
    ? String(payloadCode)
    : isGroupErrorCode(payloadMessage)
      ? String(payloadMessage)
      : null;

  if (code) return getGroupErrorMessage(code, language);

  if (candidate?.response?.status === 429) {
    return getGroupErrorMessage('MESSAGE_RATE_LIMITED', language);
  }

  if (!candidate?.response) {
    return language === 'bn'
      ? 'নেটওয়ার্ক সমস্যা হয়েছে, আবার চেষ্টা করুন'
      : 'Network problem. Please try again.';
  }

  return getGroupErrorMessage(null, language);
};
