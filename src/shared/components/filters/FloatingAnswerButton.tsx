import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, BookOpenCheck } from 'lucide-react';

import { useLanguage } from '@/shared/i18n/LanguageProvider';

interface Props {
  revealed: boolean;
  onToggle: () => void;
}

const SCROLL_DELTA = 8;

const findScrollParent = (element: HTMLElement | null): HTMLElement | null => {
  let node = element?.parentElement ?? null;
  while (node) {
    const overflowY = window.getComputedStyle(node).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
    node = node.parentElement;
  }
  return null;
};

/**
 * Show/hide every answer on the page. It sits above the bottom navigation and
 * away from the centre exam button; scrolling down hides it, scrolling up (or
 * returning to the top) brings it back. The 8px threshold means a one-finger
 * wobble never makes it flicker.
 */
export const FloatingAnswerButton: React.FC<Props> = ({ revealed, onToggle }) => {
  const { t } = useLanguage();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const container = findScrollParent(buttonRef.current);
    const target: HTMLElement | Window = container ?? window;

    const readTop = () => (container ? container.scrollTop : window.scrollY);

    let last = readTop();
    let frame = 0;

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const current = readTop();
        const delta = current - last;

        if (current <= SCROLL_DELTA) {
          setVisible(true);
          last = current;
          return;
        }
        if (delta > SCROLL_DELTA) {
          setVisible(false);
          last = current;
        } else if (delta < -SCROLL_DELTA) {
          setVisible(true);
          last = current;
        }
      });
    };

    target.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      target.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-pressed={revealed}
      onClick={onToggle}
      className={`fixed bottom-24 right-4 z-40 inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-xs font-bold shadow-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:scale-95 motion-reduce:transition-none md:bottom-6 md:right-6 ${
        visible ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-3 opacity-0'
      } ${
        revealed
          ? 'border-emerald-600 bg-emerald-600 text-white shadow-emerald-600/25 hover:bg-emerald-700'
          : 'border-card-border bg-card-bg text-text-primary hover:bg-surface'
      }`}
    >
      {revealed ? (
        <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
      ) : (
        <BookOpen className="h-4 w-4" aria-hidden="true" />
      )}
      {revealed ? t('common.hideAllAnswers') : t('common.showAllAnswers')}
    </button>
  );
};

export default FloatingAnswerButton;
