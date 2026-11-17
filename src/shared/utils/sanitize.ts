import DOMPurify from 'dompurify';

/**
 * Sanitises stored question HTML before it is injected into the DOM.
 *
 * Question bodies are authored content and may contain supported markup and
 * math (KaTeX renders into spans), but they are still untrusted input: anything
 * that can execute (scripts, event handlers, javascript: URLs, embedded frames)
 * is stripped. This mirrors the pattern already used by MathDisplay.
 */
export const sanitizeQuestionHtml = (html: string): string =>
  DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, svg: true, mathMl: true },
    ADD_ATTR: ['target', 'rel'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['style', 'srcset', 'formaction'],
  });

/** Escapes text that must be rendered literally (used for plain-text fallbacks). */
export const escapeHtmlText = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
