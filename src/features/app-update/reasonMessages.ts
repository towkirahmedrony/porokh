import type { AppMessageKey } from '@/shared/i18n/messages';
import type { OtaBlockReason } from './types';

/**
 * User-facing label for every reason the OTA layer can refuse an update.
 *
 * Shared by the banner and the App Updates panel so the same block reason is
 * never described two different ways.
 */
export const REASON_MESSAGES: Record<OtaBlockReason, AppMessageKey> = {
  exam_active: 'update.blockedExam',
  exam_route: 'update.blockedExam',
  practice_active: 'update.blockedPractice',
  battle_active: 'update.blockedBattle',
  recovery_in_progress: 'update.blockedExam',
  submission_pending: 'update.blockedSubmission',
  pending_answers: 'update.blockedAnswers',
  attempt_unresolved: 'update.attemptUnresolved',
  auth_unknown: 'update.blockedAuth',
  storage_unavailable: 'update.blockedStorage',
  storage_schema_incompatible: 'update.blockedSchema',
  native_incompatible: 'update.blockedNative',
  channel_mismatch: 'update.unsupported',
  metadata_invalid: 'update.unsupported',
  checksum_invalid: 'update.unsupported',
  unsigned_bundle: 'update.blockedSignature',
  plugin_unavailable: 'update.unsupported',
  activation_not_applied: 'update.failedTitle',
};

/** Most actionable reason wins when several are reported at once. */
const REASON_PRIORITY: OtaBlockReason[] = [
  'pending_answers',
  'practice_active',
  'battle_active',
  'submission_pending',
  'attempt_unresolved',
  'exam_active',
  'exam_route',
  'recovery_in_progress',
  'storage_unavailable',
  'storage_schema_incompatible',
  'native_incompatible',
  'channel_mismatch',
  'metadata_invalid',
  'checksum_invalid',
  'unsigned_bundle',
  'auth_unknown',
  'activation_not_applied',
  'plugin_unavailable',
];

export const primaryReason = (reasons: OtaBlockReason[]): OtaBlockReason | null =>
  REASON_PRIORITY.find((reason) => reasons.includes(reason)) ?? reasons[0] ?? null;
