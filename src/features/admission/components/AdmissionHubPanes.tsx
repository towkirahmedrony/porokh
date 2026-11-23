import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AdmissionHubTab } from '../types/admissionHub';

interface AdmissionHubPane {
  value: AdmissionHubTab;
  content: React.ReactNode;
}

interface AdmissionHubPanesProps {
  active: AdmissionHubTab;
  panes: AdmissionHubPane[];
  onChange: (tab: AdmissionHubTab) => void;
}

/** How long a tab-tap scroll is allowed to animate before scroll sync resumes. */
const PROGRAMMATIC_SCROLL_MS = 600;

/**
 * Horizontal tab pager for the admission unit hub.
 *
 * Panes are stacked in a CSS scroll-snap track (100% wide, mandatory snap), so
 * switching tabs is a native horizontal swipe on Android/WebView and needs no
 * gesture library. Each pane owns its vertical scroll area: the track height is
 * measured against the app shell so the tab bar stays put and vertical scrolling
 * never pages through the whole document.
 *
 * A tab is rendered the first time it is visited and then kept mounted, so
 * swiping back does not refetch requests or reset the pane's scroll position.
 */
const AdmissionHubPanes: React.FC<AdmissionHubPanesProps> = ({
  active,
  panes,
  onChange,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const panesRef = useRef(panes);
  const activeRef = useRef(active);
  const onChangeRef = useRef(onChange);
  const programmaticRef = useRef<number | null>(null);
  const scrollDrivenRef = useRef(false);
  const initialisedRef = useRef(false);
  const [height, setHeight] = useState<number | null>(null);
  const [visited, setVisited] = useState<Set<AdmissionHubTab>>(
    () => new Set([active])
  );

  panesRef.current = panes;
  activeRef.current = active;
  onChangeRef.current = onChange;

  useEffect(() => {
    setVisited((previous) => {
      if (previous.has(active)) return previous;
      const next = new Set(previous);
      next.add(active);
      return next;
    });
  }, [active]);

  // Keep the active tab highlight in sync with the scroll position, including
  // mid-swipe. A tab-tap scroll is ignored until its animation settles so the
  // highlight cannot flip through the intermediate tabs.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let frame = 0;
    const handleScroll = () => {
      if (programmaticRef.current !== null || frame) return;

      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const width = track.clientWidth;
        if (!width) return;

        const lastIndex = panesRef.current.length - 1;
        const index = Math.min(
          lastIndex,
          Math.max(0, Math.round(track.scrollLeft / width))
        );
        const next = panesRef.current[index]?.value;

        if (next && next !== activeRef.current) {
          scrollDrivenRef.current = true;
          onChangeRef.current(next);
        }
      });
    };

    track.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      track.removeEventListener('scroll', handleScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  // Move the track when the selected tab changes from outside the scroll (a tap
  // on the tab bar or a deep link). The first alignment is instant, later ones
  // are smooth.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    if (scrollDrivenRef.current) {
      scrollDrivenRef.current = false;
      return;
    }

    const index = panesRef.current.findIndex((pane) => pane.value === active);
    const width = track.clientWidth;
    if (index < 0 || !width) return;

    const target = index * width;
    if (Math.abs(track.scrollLeft - target) <= 2) {
      initialisedRef.current = true;
      return;
    }

    if (programmaticRef.current !== null) {
      window.clearTimeout(programmaticRef.current);
    }
    programmaticRef.current = window.setTimeout(() => {
      programmaticRef.current = null;
    }, PROGRAMMATIC_SCROLL_MS);

    if (initialisedRef.current) {
      track.scrollTo({ left: target, behavior: 'smooth' });
    } else {
      track.scrollLeft = target;
    }
    initialisedRef.current = true;
  }, [active]);

  // Size the pager to the space the app shell leaves between its header and the
  // fixed bottom navigation, so panes scroll vertically on their own.
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const main = track.closest('main');
    if (!main) return;

    let frame = 0;
    const measure = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const mainRect = main.getBoundingClientRect();
        const offset = track.getBoundingClientRect().top - mainRect.top;
        const desktop = window.matchMedia('(min-width: 768px)').matches;
        // MainLayout reserves 96px on mobile for the fixed bottom nav and 24px
        // on desktop where the nav is hidden.
        const bottomInset = desktop ? 24 : 96;
        const next = Math.max(
          220,
          Math.round(main.clientHeight - offset - bottomInset)
        );
        setHeight(next);
      });
    };

    measure();

    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(main);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    document.fonts?.ready.then(measure).catch(() => undefined);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, []);

  useEffect(
    () => () => {
      if (programmaticRef.current !== null) {
        window.clearTimeout(programmaticRef.current);
      }
    },
    []
  );

  return (
    <div
      ref={trackRef}
      className="no-scrollbar mt-3 flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain"
      style={height ? { height } : undefined}
    >
      {panes.map((pane) => (
        <section
          key={pane.value}
          role="tabpanel"
          id={`admission-hub-panel-${pane.value}`}
          aria-labelledby={`admission-hub-tab-${pane.value}`}
          className="h-full w-full flex-none snap-start snap-always overflow-y-auto overscroll-contain pb-3"
        >
          {pane.value === active || visited.has(pane.value)
            ? pane.content
            : null}
        </section>
      ))}
    </div>
  );
};

export default AdmissionHubPanes;
