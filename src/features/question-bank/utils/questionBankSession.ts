export interface QuestionBankSessionState {
  /** Number of question pages the user had loaded before the refresh. */
  pageCount: number;
  /** Scroll offset of the question list container. */
  scrollY: number;
}

type SessionStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const KEY_PREFIX = 'porokh.question-bank.view:';

const getStorage = (): SessionStore | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export function questionBankSessionKey(pathname: string, search: string): string {
  return `${KEY_PREFIX}${pathname}${search}`;
}

const toSafePageCount = (value: unknown): number => {
  const count = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(count) && count > 0 ? count : 0;
};

const toSafeScrollY = (value: unknown): number => {
  const offset = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(offset) && offset > 0 ? offset : 0;
};

export function readQuestionBankSession(
  key: string,
  storage: SessionStore | null = getStorage()
): QuestionBankSessionState | null {
  if (!storage) return null;

  try {
    const raw = storage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return null;

    const pageCount = toSafePageCount(parsed.pageCount);
    const scrollY = toSafeScrollY(parsed.scrollY);

    if (pageCount === 0 && scrollY === 0) return null;
    return { pageCount, scrollY };
  } catch {
    return null;
  }
}

export function writeQuestionBankSession(
  key: string,
  patch: Partial<QuestionBankSessionState>,
  storage: SessionStore | null = getStorage()
): void {
  if (!storage) return;

  try {
    const previous = readQuestionBankSession(key, storage);
    const next: QuestionBankSessionState = {
      pageCount:
        patch.pageCount !== undefined
          ? toSafePageCount(patch.pageCount)
          : previous?.pageCount ?? 0,
      scrollY:
        patch.scrollY !== undefined
          ? toSafeScrollY(patch.scrollY)
          : previous?.scrollY ?? 0,
    };

    if (next.pageCount === 0 && next.scrollY === 0) {
      storage.removeItem(key);
      return;
    }

    storage.setItem(key, JSON.stringify(next));
  } catch {
    // Session storage can be unavailable (private mode, quota); persistence is
    // an enhancement, never a reason to break the page.
  }
}
