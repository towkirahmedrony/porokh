const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

/** Create a high-entropy, log-safe ID for one network submission attempt. */
export const createSubmissionRequestId = (): string => {
  const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;

  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Legacy WebView fallback: restricted characters, bounded length, and a
  // per-invocation random component. The server replaces malformed IDs.
  return `submit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
};

/** Store an ID-keyed browser timing entry without writing production logs. */
export const recordSubmissionHttpMeasure = (requestId: string, startedAt: number): void => {
  if (typeof performance === 'undefined' || typeof performance.mark !== 'function') return;

  const startMark = `exam-submit:${requestId}:start`;
  const endMark = `exam-submit:${requestId}:response`;

  try {
    performance.mark(startMark, { startTime: startedAt });
    performance.mark(endMark);
    performance.measure(`exam-submit:${requestId}:http`, startMark, endMark);
    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
  } catch {
    // Performance entries are diagnostic only and must never affect submission.
  }
};

export const isValidSubmissionRequestId = (value: string): boolean =>
  REQUEST_ID_PATTERN.test(value);
