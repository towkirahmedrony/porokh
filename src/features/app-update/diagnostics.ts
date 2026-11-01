export type OtaDiagnosticLevel = 'info' | 'warning' | 'error';

export type OtaDiagnosticEntry = {
  at: string;
  level: OtaDiagnosticLevel;
  event: string;
  details: Record<string, string | number | boolean | null>;
};

const STORAGE_KEY = 'porokh.ota.diagnostics.v1';
const CHANGE_EVENT = 'porokh:ota-diagnostics-updated';
const MAX_ENTRIES = 120;
const MAX_TEXT_LENGTH = 360;
const SENSITIVE_FIELD = /(authorization|access.?token|refresh.?token|token|secret|password|session|private.?key|checksum|signature)/i;

const getStorage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

export const sanitizeDiagnosticText = (value: unknown): string => {
  let text = typeof value === 'string' ? value : String(value ?? '');

  text = text
    .replace(
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/gi,
      '[private key redacted]'
    )
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [redacted]')
    .replace(/(\bhttps?:\/\/[^\s?#"']+)\?[^\s#"']*/gi, '$1?[query redacted]')
    .replace(
      /\b(authorization|access_token|refresh_token|token|secret|session[_-]?key|private[_-]?key|signature|checksum)\s*[:=]\s*[^\s,;&]+/gi,
      '$1=[redacted]'
    )
    .replace(/\b[A-Za-z0-9_+/=-]{96,}\b/g, '[long value redacted]')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return text.slice(0, MAX_TEXT_LENGTH);
};

const safePrimitive = (
  key: string,
  value: unknown
): string | number | boolean | null | undefined => {
  if (SENSITIVE_FIELD.test(key)) return '[redacted]';
  if (value === null) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') return sanitizeDiagnosticText(value);
  return undefined;
};

export const sanitizeDiagnosticDetails = (
  details: Record<string, unknown> = {}
): Record<string, string | number | boolean | null> => {
  const safe: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(details).slice(0, 16)) {
    const safeValue = safePrimitive(key, value);
    if (safeValue !== undefined) safe[key.slice(0, 48)] = safeValue;
  }

  return safe;
};

export const diagnosticErrorDetails = (
  error: unknown
): Record<string, string | number | boolean | null> => {
  const source =
    error && typeof error === 'object'
      ? (error as Record<string, unknown>)
      : {};
  const errorName =
    error instanceof Error
      ? error.name
      : typeof source.name === 'string'
        ? source.name
        : 'Error';
  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof source.message === 'string'
        ? source.message
        : typeof source.error === 'string'
          ? source.error
          : String(error ?? 'Unknown error');

  return sanitizeDiagnosticDetails({
    errorName,
    errorCode: source.code ?? source.errorCode ?? source.nativeCode ?? null,
    httpStatus: source.status ?? source.statusCode ?? null,
    errorMessage,
  });
};

const isEntry = (value: unknown): value is OtaDiagnosticEntry => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<OtaDiagnosticEntry>;
  return (
    typeof item.at === 'string' &&
    (item.level === 'info' || item.level === 'warning' || item.level === 'error') &&
    typeof item.event === 'string' &&
    !!item.details &&
    typeof item.details === 'object'
  );
};

export const getOtaDiagnosticEntries = (): OtaDiagnosticEntry[] => {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry).slice(-MAX_ENTRIES);
  } catch {
    return [];
  }
};

export const recordOtaDiagnostic = (
  level: OtaDiagnosticLevel,
  event: string,
  details: Record<string, unknown> = {}
): void => {
  const storage = getStorage();
  if (!storage) return;

  const entry: OtaDiagnosticEntry = {
    at: new Date().toISOString(),
    level,
    event: sanitizeDiagnosticText(event).replace(/[^a-zA-Z0-9_.:-]/g, '_').slice(0, 64),
    details: sanitizeDiagnosticDetails(details),
  };

  try {
    const entries = [...getOtaDiagnosticEntries(), entry].slice(-MAX_ENTRIES);
    storage.setItem(STORAGE_KEY, JSON.stringify(entries));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Diagnostic logging must never interrupt update or exam flows.
  }
};

export const clearOtaDiagnosticEntries = (): void => {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Clearing diagnostics is best-effort when storage is unavailable.
  }
};

export const subscribeOtaDiagnosticEntries = (
  listener: (entries: OtaDiagnosticEntry[]) => void
): (() => void) => {
  if (typeof window === 'undefined') return () => undefined;
  const update = () => listener(getOtaDiagnosticEntries());
  window.addEventListener(CHANGE_EVENT, update);
  window.addEventListener('storage', update);
  return () => {
    window.removeEventListener(CHANGE_EVENT, update);
    window.removeEventListener('storage', update);
  };
};

export const formatOtaDiagnosticEntries = (
  entries = getOtaDiagnosticEntries()
): string => entries.map((entry) => JSON.stringify(entry)).join('\n');
