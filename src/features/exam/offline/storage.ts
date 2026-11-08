import { OFFLINE_SCHEMA_VERSION } from './schemaVersion';
import type {
  AnswerRecord,
  ExamAttemptRecord,
  PreparedExamRecord,
  SubmissionRecord,
} from './types';

/**
 * Counts of locally stored work that a WebView reload would strand.
 *
 * Counted across every user, not just the signed-in one: a queued submission
 * belongs to the user who created it, and signing out must not make the OTA
 * gate blind to it.
 */
export type PendingOfflineWork = {
  inProgressAttempts: number;
  pendingSubmissions: number;
  pendingAnswers: number;
};

export const EMPTY_PENDING_WORK: PendingOfflineWork = {
  inProgressAttempts: 0,
  pendingSubmissions: 0,
  pendingAnswers: 0,
};

/**
 * The offline exam store boundary.
 *
 * The OTA activation gate depends on `init`, `listPendingWork` and
 * `listAttemptsForUser`. The prepared-exam methods hold the complete downloaded
 * dataset that lets an exam start without connectivity.
 *
 * `init()` must reject when the store cannot open at the expected schema
 * version; `schema.ts` classifies a version-flavoured failure as schema
 * incompatibility rather than a transient storage outage.
 */
export interface OfflineExamStorage {
  init(): Promise<void>;

  putAttempt(attempt: ExamAttemptRecord): Promise<void>;
  getAttempt(attemptId: string): Promise<ExamAttemptRecord | null>;
  listAttemptsForUser(userId: string): Promise<ExamAttemptRecord[]>;
  /** Every user's unfinished work, so activation is not auth-dependent. */
  listPendingWork(): Promise<PendingOfflineWork>;
  removeAttempt(attemptId: string): Promise<void>;

  putSubmission(submission: SubmissionRecord): Promise<void>;
  getSubmission(attemptId: string): Promise<SubmissionRecord | null>;
  listSubmissionsForUser(userId: string): Promise<SubmissionRecord[]>;
  listAnswersForUser(userId: string): Promise<AnswerRecord[]>;
  removeSubmission(attemptId: string): Promise<void>;

  putAnswerIfNewer(answer: AnswerRecord): Promise<void>;
  getAnswers(attemptId: string): Promise<AnswerRecord[]>;

  putPreparedExam(exam: PreparedExamRecord): Promise<void>;
  getPreparedExam(key: string): Promise<PreparedExamRecord | null>;
  listPreparedExams(userId: string): Promise<PreparedExamRecord[]>;
  removePreparedExam(key: string): Promise<void>;
}

const clone = <T>(value: T): T => {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
};

/**
 * Deterministic in-memory implementation used by the unit tests and as the
 * safe fallback when IndexedDB is unavailable. It models the same contract as
 * the persistent store but never survives a restart.
 */
export class MemoryOfflineExamStorage implements OfflineExamStorage {
  private attempts = new Map<string, ExamAttemptRecord>();
  private submissions = new Map<string, SubmissionRecord>();
  private answers = new Map<string, AnswerRecord[]>();
  private prepared = new Map<string, PreparedExamRecord>();

  async init(): Promise<void> {
    // Nothing to open or migrate; the in-memory store is always ready.
  }

  async putAttempt(attempt: ExamAttemptRecord): Promise<void> {
    this.attempts.set(attempt.attemptId, clone(attempt));
  }

  async getAttempt(attemptId: string): Promise<ExamAttemptRecord | null> {
    const record = this.attempts.get(attemptId);
    return record ? clone(record) : null;
  }

  async listAttemptsForUser(userId: string): Promise<ExamAttemptRecord[]> {
    return [...this.attempts.values()]
      .filter((attempt) => attempt.userId === userId)
      .map((attempt) => clone(attempt));
  }

  async listPendingWork(): Promise<PendingOfflineWork> {
    return {
      inProgressAttempts: [...this.attempts.values()].filter(
        (attempt) => attempt.status === 'in_progress'
      ).length,
      pendingSubmissions: [...this.submissions.values()].filter(
        (submission) => submission.status !== 'confirmed'
      ).length,
      pendingAnswers: [...this.answers.values()]
        .flat()
        .filter((answer) => answer.status !== 'synced').length,
    };
  }

  async removeAttempt(attemptId: string): Promise<void> {
    this.attempts.delete(attemptId);
    this.submissions.delete(attemptId);
    this.answers.delete(attemptId);
  }

  async putSubmission(submission: SubmissionRecord): Promise<void> {
    this.submissions.set(submission.attemptId, clone(submission));
  }

  async getSubmission(attemptId: string): Promise<SubmissionRecord | null> {
    const record = this.submissions.get(attemptId);
    return record ? clone(record) : null;
  }

  async listSubmissionsForUser(userId: string): Promise<SubmissionRecord[]> {
    return [...this.submissions.values()]
      .filter((submission) => submission.userId === userId)
      .map((submission) => clone(submission));
  }
  async listAnswersForUser(userId: string): Promise<AnswerRecord[]> {
    return [...this.answers.values()]
      .flat()
      .filter((answer) => answer.userId === userId)
      .map((answer) => clone(answer));
  }

  async removeSubmission(attemptId: string): Promise<void> {
    this.submissions.delete(attemptId);
  }

  async putAnswerIfNewer(answer: AnswerRecord): Promise<void> {
    const existing = this.answers.get(answer.attemptId) ?? [];
    const index = existing.findIndex((item) => item.id === answer.id);
    const next = [...existing];

    if (index >= 0) {
      // Last-writer-wins only for a strictly newer revision; a stale replay of
      // an older revision must never overwrite the newer answer.
      if (answer.revision <= next[index].revision) return;
      next[index] = clone(answer);
    } else {
      next.push(clone(answer));
    }

    this.answers.set(answer.attemptId, next);
  }

  async getAnswers(attemptId: string): Promise<AnswerRecord[]> {
    return (this.answers.get(attemptId) ?? []).map((answer) => clone(answer));
  }

  async putPreparedExam(exam: PreparedExamRecord): Promise<void> {
    this.prepared.set(exam.key, clone(exam));
  }

  async getPreparedExam(key: string): Promise<PreparedExamRecord | null> {
    const record = this.prepared.get(key);
    return record ? clone(record) : null;
  }

  async listPreparedExams(userId: string): Promise<PreparedExamRecord[]> {
    return [...this.prepared.values()]
      .filter((exam) => exam.userId === userId)
      .map((exam) => clone(exam));
  }

  async removePreparedExam(key: string): Promise<void> {
    this.prepared.delete(key);
  }
}

const DB_NAME = 'porokh-offline-exam';
/**
 * The database version *is* the offline schema version. It is sourced from
 * `schemaVersion.ts` so the OTA gate, the client constant and the publisher all
 * quote the same number instead of three drifting literals.
 */
const DB_VERSION = OFFLINE_SCHEMA_VERSION;
const STORE_ATTEMPTS = 'attempts';
const STORE_SUBMISSIONS = 'submissions';
const STORE_ANSWERS = 'answers';
const STORE_PREPARED = 'prepared';

const requestResult = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('IndexedDB request failed'));
  });

const requestDone = (request: IDBRequest): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(request.error ?? new Error('IndexedDB request failed'));
  });

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_ATTEMPTS)) {
        const attempts = db.createObjectStore(STORE_ATTEMPTS, {
          keyPath: 'attemptId',
        });
        attempts.createIndex('userId', 'userId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SUBMISSIONS)) {
        const submissions = db.createObjectStore(STORE_SUBMISSIONS, {
          keyPath: 'attemptId',
        });
        submissions.createIndex('userId', 'userId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_ANSWERS)) {
        const answers = db.createObjectStore(STORE_ANSWERS, { keyPath: 'id' });
        answers.createIndex('attemptId', 'attemptId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_PREPARED)) {
        const prepared = db.createObjectStore(STORE_PREPARED, { keyPath: 'key' });
        prepared.createIndex('userId', 'userId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('IndexedDB open failed'));
    request.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });

/**
 * IndexedDB-backed persistent store for the browser/WebView runtime. The
 * database version doubles as the local schema version; a database opened at a
 * different version fails `init()` so the OTA gate treats it as schema
 * incompatibility and never activates a bundle against the wrong data.
 */
export class IndexedDbOfflineExamStorage implements OfflineExamStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    const db = await openDatabase();
    if (db.version !== DB_VERSION) {
      db.close();
      throw new Error(
        'offline schema version mismatch (downgrade not supported)'
      );
    }
    this.db = db;
  }

  private requireDb(): IDBDatabase {
    if (!this.db) throw new Error('offline storage is not initialised');
    return this.db;
  }

  private store(name: string, mode: IDBTransactionMode): IDBObjectStore {
    return this.requireDb().transaction(name, mode).objectStore(name);
  }

  async putAttempt(attempt: ExamAttemptRecord): Promise<void> {
    const request = this.store(STORE_ATTEMPTS, 'readwrite').put(clone(attempt));
    await requestDone(request);
  }

  async getAttempt(attemptId: string): Promise<ExamAttemptRecord | null> {
    const request = this.store(STORE_ATTEMPTS, 'readonly').get(attemptId);
    const record = await requestResult(request);
    return (record as ExamAttemptRecord | undefined) ?? null;
  }

  async listAttemptsForUser(userId: string): Promise<ExamAttemptRecord[]> {
    const index = this.store(STORE_ATTEMPTS, 'readonly').index('userId');
    const request = index.getAll(userId);
    const records = await requestResult(request);
    return (records as ExamAttemptRecord[]).map((record) => clone(record));
  }

  /**
   * Count unfinished work across every stored user.
   *
   * A reload cannot lose data that is already in IndexedDB, but it can strand a
   * submission that has not been confirmed yet. Counting globally means the
   * gate still sees that work when the device is signed out.
   */
  async listPendingWork(): Promise<PendingOfflineWork> {
    const attempts = (await requestResult(
      this.store(STORE_ATTEMPTS, 'readonly').getAll()
    )) as ExamAttemptRecord[];
    const submissions = (await requestResult(
      this.store(STORE_SUBMISSIONS, 'readonly').getAll()
    )) as SubmissionRecord[];
    const answers = (await requestResult(
      this.store(STORE_ANSWERS, 'readonly').getAll()
    )) as AnswerRecord[];

    return {
      inProgressAttempts: attempts.filter(
        (attempt) => attempt.status === 'in_progress'
      ).length,
      pendingSubmissions: submissions.filter(
        (submission) => submission.status !== 'confirmed'
      ).length,
      pendingAnswers: answers.filter((answer) => answer.status !== 'synced')
        .length,
    };
  }

  async removeAttempt(attemptId: string): Promise<void> {
    const db = this.requireDb();
    const transaction = db.transaction(
      [STORE_ATTEMPTS, STORE_SUBMISSIONS, STORE_ANSWERS],
      'readwrite'
    );
    transaction.objectStore(STORE_ATTEMPTS).delete(attemptId);
    transaction.objectStore(STORE_SUBMISSIONS).delete(attemptId);

    const answers = transaction.objectStore(STORE_ANSWERS).index('attemptId');
    const cursorRequest = answers.openKeyCursor(
      IDBKeyRange.only(attemptId)
    );
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      transaction.objectStore(STORE_ANSWERS).delete(cursor.primaryKey);
      cursor.continue();
    };

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error('IndexedDB transaction failed'));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    });
  }

  async putSubmission(submission: SubmissionRecord): Promise<void> {
    const request = this.store(STORE_SUBMISSIONS, 'readwrite').put(
      clone(submission)
    );
    await requestDone(request);
  }

  async getSubmission(attemptId: string): Promise<SubmissionRecord | null> {
    const request = this.store(STORE_SUBMISSIONS, 'readonly').get(attemptId);
    const record = await requestResult(request);
    return (record as SubmissionRecord | undefined) ?? null;
  }

  async listSubmissionsForUser(userId: string): Promise<SubmissionRecord[]> {
    const index = this.store(STORE_SUBMISSIONS, 'readonly').index('userId');
    const request = index.getAll(userId);
    const records = await requestResult(request);
    return (records as SubmissionRecord[]).map((record) => clone(record));
  }
  async listAnswersForUser(userId: string): Promise<AnswerRecord[]> {
    // Keep this compatible with pre-index records created by schema v2.
    const request = this.store(STORE_ANSWERS, 'readonly').getAll();
    const records = await requestResult(request);
    return (records as AnswerRecord[])
      .filter((record) => record.userId === userId)
      .map((record) => clone(record));
  }

  async removeSubmission(attemptId: string): Promise<void> {
    const request = this.store(STORE_SUBMISSIONS, 'readwrite').delete(attemptId);
    await requestDone(request);
  }

  async putAnswerIfNewer(answer: AnswerRecord): Promise<void> {
    const db = this.requireDb();

    // The read-then-write must happen inside one synchronous transaction step;
    // awaiting between the get and the put would let IndexedDB auto-commit the
    // transaction and throw TransactionInactiveError.
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_ANSWERS, 'readwrite');
      const store = transaction.objectStore(STORE_ANSWERS);
      const getRequest = store.get(answer.id);

      getRequest.onsuccess = () => {
        const existing = getRequest.result as AnswerRecord | undefined;
        if (existing && existing.revision >= answer.revision) {
          // Stale replay of an older revision; abort is the expected outcome.
          transaction.abort();
          return;
        }
        store.put(clone(answer));
      };
      getRequest.onerror = () =>
        reject(getRequest.error ?? new Error('IndexedDB request failed'));

      transaction.oncomplete = () => resolve();
      transaction.onabort = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    });
  }

  async getAnswers(attemptId: string): Promise<AnswerRecord[]> {
    const index = this.store(STORE_ANSWERS, 'readonly').index('attemptId');
    const request = index.getAll(attemptId);
    const records = await requestResult(request);
    return (records as AnswerRecord[]).map((record) => clone(record));
  }

  async putPreparedExam(exam: PreparedExamRecord): Promise<void> {
    const request = this.store(STORE_PREPARED, 'readwrite').put(clone(exam));
    await requestDone(request);
  }

  async getPreparedExam(key: string): Promise<PreparedExamRecord | null> {
    const request = this.store(STORE_PREPARED, 'readonly').get(key);
    const record = await requestResult(request);
    return (record as PreparedExamRecord | undefined) ?? null;
  }

  async listPreparedExams(userId: string): Promise<PreparedExamRecord[]> {
    const index = this.store(STORE_PREPARED, 'readonly').index('userId');
    const request = index.getAll(userId);
    const records = await requestResult(request);
    return (records as PreparedExamRecord[]).map((record) => clone(record));
  }

  async removePreparedExam(key: string): Promise<void> {
    const request = this.store(STORE_PREPARED, 'readwrite').delete(key);
    await requestDone(request);
  }
}

let singleton: OfflineExamStorage | null = null;

/**
 * Returns the process-wide offline exam store, preferring a persistent
 * IndexedDB-backed store when the runtime provides IndexedDB (browser/WebView)
 * and falling back to memory otherwise. This must never throw: it is called
 * eagerly when the OTA controller is constructed, including on the web/PWA
 * where the updater itself stays disabled.
 */
export const getOfflineExamStorage = (): OfflineExamStorage => {
  if (!singleton) {
    singleton =
      typeof indexedDB !== 'undefined'
        ? new IndexedDbOfflineExamStorage()
        : new MemoryOfflineExamStorage();
  }
  return singleton;
};
