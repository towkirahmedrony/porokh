/**
 * Phase 1/4 offline exam storage contracts.
 *
 * These record shapes are the durable contract the OTA activation gate reads
 * to decide whether an in-flight exam attempt (or its pending submission /
 * unsynced answers) must block a WebView reload. They intentionally carry a
 * plain-data shape so they can be persisted to IndexedDB and reconstructed
 * without losing fidelity.
 *
 * `status` is the field the gate inspects:
 *   - an `in_progress` attempt blocks activation (`attempt_unresolved`);
 *   - a submission whose status is not `confirmed` blocks (`submission_pending`);
 *   - an answer whose status is not `synced` blocks (`pending_answers`).
 */

export type ExamAttemptStatus =
  | 'draft'
  | 'prepared'
  | 'in_progress'
  | 'submitting'
  | 'submitted'
  | 'expired'
  | 'error';

export type SubmissionStatus = 'pending' | 'submitting' | 'confirmed' | 'failed';

export type AnswerSyncStatus = 'pending' | 'synced' | 'failed';

/**
 * Whether a given exam may be attempted without connectivity.
 * `offline_allowed` is the only policy the offline pipeline fully supports.
 */
export type OfflinePolicy = 'offline_allowed' | 'offline_blocked' | 'online_only';

export interface ExamAttemptRecord {
  /** Stable composite key, e.g. `practice:e1` or `admission:p1`. */
  key: string;
  userId: string;
  /** Attempt scope discriminator, e.g. `practice` or `admission`. */
  scope: string;
  attemptId: string;
  examId: string;
  status: ExamAttemptStatus;
  offlinePolicy: OfflinePolicy;
  /** Epoch ms the attempt was started, or null when not yet started. */
  startedAt: number | null;
  /** Epoch ms the attempt must finish by, or null when untimed. */
  deadlineAt: number | null;
  serverTimeAtSync: number | null;
  clientTimeAtSync: number | null;
  wallHighWaterMs: number | null;
  secondsRemainingAtSync: number | null;
  durationSeconds: number;
  questionIds: string[];
  questionsVersion: string | null;
  prepared: boolean;
  currentIndex: number;
  lastServerUpdatedAt: string | null;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  syncAttempts: number;
  nextSyncAt: number | null;
  submissionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionRecord {
  attemptId: string;
  userId: string;
  status: SubmissionStatus;
  /** Stable idempotency key so a retry cannot create a duplicate submission. */
  idempotencyKey: string;
  /** The exact payload to POST; retained so a retry sends identical bytes. */
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  lastAttemptAt: number | null;
  /** Epoch ms before which a retry must not run (bounded backoff). */
  nextAttemptAt?: number | null;
  lastError: string | null;
  resultId: string | null;
  result: unknown;
}

export interface AnswerRecord {
  /** Stable answer id, e.g. `${attemptId}:${questionId}`. */
  id: string;
  attemptId: string;
  userId: string;
  questionId: string;
  value: string;
  /** Monotonic revision; only newer revisions overwrite older ones. */
  revision: number;
  /** Idempotency scope for the write that produced this revision. */
  operationId: string;
  updatedAt: string;
  status: AnswerSyncStatus;
  lastError: string | null;
}

// ---------------------------------------------------------------------------
// Offline-prepared exam dataset
// ---------------------------------------------------------------------------

export type PreparedExamKind = 'exam' | 'practice';

/** A single cached option. Never contains the answer key (`is_correct`). */
export interface OfflineQuestionOption {
  id: string;
  text?: string | null;
  text_bn?: string | null;
  text_en?: string | null;
  image_url?: string | null;
  [key: string]: unknown;
}

/**
 * A sanitized question snapshot sufficient for the existing question renderer.
 * The backend only ever sends the public projection (no `is_correct`), so
 * caching these never leaks the answer key to a device.
 */
export interface OfflineQuestion {
  id: string;
  text?: string | null;
  text_bn?: string | null;
  text_en?: string | null;
  body?: Record<string, unknown> | null;
  image_url?: string | null;
  media_library?: Record<string, unknown> | null;
  comprehension?: Record<string, unknown> | null;
  options: OfflineQuestionOption[];
  [key: string]: unknown;
}

/**
 * A complete, validated exam dataset persisted by the offline-preparation flow.
 * It is created while online (a server attempt is started first, so the server
 * has already authorized the attempt and issued its id, deadline and question
 * set) and must be present before the exam can be started offline.
 */
export interface PreparedExamRecord {
  /** Stable key, e.g. `offline:exam:<examId>` or `offline:practice:<attemptId>`. */
  key: string;
  examId: string | null;
  /** Server-issued attempt id; reuses the authoritative attempt lifecycle. */
  attemptId: string;
  kind: PreparedExamKind;
  title: string | null;
  durationSeconds: number;
  startedAt: string;
  deadlineAt: string;
  questionIds: string[];
  questions: OfflineQuestion[];
  schemaVersion: number;
  preparedAt: string;
  userId: string;
}

export const OFFLINE_SCHEMA_VERSION = 1;

/** Result of validating a prepared exam before it can be started offline. */
export type PreparedExamValidation =
  | { ok: true }
  | { ok: false; reason: OfflinePrepareBlockReason };

export type OfflinePrepareBlockReason =
  | 'missing'
  | 'schema_incompatible'
  | 'expired'
  | 'incomplete'
  | 'corrupted';
