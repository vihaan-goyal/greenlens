import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Draggable + snap-home wrapper for the in-page card.
 *
 * Three modes:
 *  - 'home-static'  → anchored bottom-right via right/bottom (panel grows up)
 *  - 'free'         → anchored by left/top wherever the user dropped it
 *  - 'snapping-home'→ transient: animate left/top toward computed home coords,
 *                     then atomically swap to right/bottom when settled
 *
 * Why the swap dance: CSS can't transition between right/bottom and left/top,
 * so we measure home's actual viewport coordinates at snap time, animate
 * left/top into that exact spot, then flip the anchor back to right/bottom
 * after the transition completes. The visual is one seamless slide.
 *
 * The trigger button stays clickable: a drag is only detected after the
 * pointer crosses a small threshold (DRAG_THRESHOLD px). If the user just
 * taps without moving, the click bubbles through and the panel opens.
 */

const POS_KEY = 'greenlens.pillPos';
const HOME_MARGIN = 16;
const DRAG_THRESHOLD = 5;
const SNAP_DISTANCE = 140;
const SNAP_DURATION_MS = 480;
const SNAP_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

type Stored = { kind: 'home' } | { kind: 'free'; left: number; top: number };

type Mode = 'home-static' | 'free' | 'snapping-home';

interface ViewState {
  mode: Mode;
  left?: number;
  top?: number;
  nearHome?: boolean;
}

interface Props {
  children: React.ReactNode;
  /** Fires once per drag when the pointer crosses the drag threshold. Lets
   *  the parent close any open panel so it doesn't fly around mid-grab. */
  onDragStart?: () => void;
}

export function Floater({ children, onDragStart }: Props) {
  const [view, setView] = useState<ViewState>({ mode: 'home-static' });
  const elRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
    isDragging: boolean;
  } | null>(null);
  const moveRef = useRef<(e: PointerEvent) => void>(() => {});
  const upRef = useRef<(e: PointerEvent) => void>(() => {});

  // Hydrate from chrome.storage. If the API isn't there (dev preview, tests),
  // we silently stay at home — it's just a position cache.
  useEffect(() => {
    try {
      chrome.storage.local.get([POS_KEY], (st) => {
        const v = st[POS_KEY] as Stored | undefined;
        if (!v) return;
        if (v.kind === 'home') setView({ mode: 'home-static' });
        else setView({ mode: 'free', left: v.left, top: v.top });
      });
    } catch {
      /* not in extension context */
    }
  }, []);

  // Persist whenever we're at a settled position (not mid-snap).
  useEffect(() => {
    if (view.mode === 'snapping-home') return;
    try {
      const payload: Stored =
        view.mode === 'home-static'
          ? { kind: 'home' }
          : { kind: 'free', left: view.left ?? 0, top: view.top ?? 0 };
      chrome.storage.local.set({ [POS_KEY]: payload });
    } catch {
      /* */
    }
  }, [view.mode, view.left, view.top]);

  // Clamp a free position into the viewport when the window resizes — the
  // pill would otherwise be stranded off-screen on browser resize.
  useEffect(() => {
    function onResize() {
      if (view.mode !== 'free') return;
      const el = elRef.current;
      if (!el) return;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const maxL = window.innerWidth - w - 4;
      const maxT = window.innerHeight - h - 4;
      const cl = Math.max(4, Math.min(maxL, view.left ?? 0));
      const ct = Math.max(4, Math.min(maxT, view.top ?? 0));
      if (cl !== view.left || ct !== view.top) {
        setView({ mode: 'free', left: cl, top: ct });
      }
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [view]);

  const getHomeAbs = useCallback(() => {
    const el = elRef.current;
    const w = el?.offsetWidth ?? 200;
    const h = el?.offsetHeight ?? 80;
    return {
      left: Math.round(window.innerWidth - w - HOME_MARGIN),
      top: Math.round(window.innerHeight - h - HOME_MARGIN),
    };
  }, []);

  const onPointerMoveWindow = useCallback(
    (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!d.isDragging) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        d.isDragging = true;
        onDragStart?.();
      }
      e.preventDefault();
      const el = elRef.current;
      const w = el?.offsetWidth ?? 200;
      const h = el?.offsetHeight ?? 80;
      const nextL = Math.max(
        4,
        Math.min(window.innerWidth - w - 4, d.startLeft + dx),
      );
      const nextT = Math.max(
        4,
        Math.min(window.innerHeight - h - 4, d.startTop + dy),
      );
      const home = getHomeAbs();
      const near = Math.hypot(nextL - home.left, nextT - home.top) < SNAP_DISTANCE;
      setView({ mode: 'free', left: nextL, top: nextT, nearHome: near });
    },
    [getHomeAbs, onDragStart],
  );

  const onPointerUpWindow = useCallback(
    (_e: PointerEvent) => {
      const d = dragRef.current;
      dragRef.current = null;
      window.removeEventListener('pointermove', moveRef.current);
      if (!d || !d.isDragging) return;

      // Suppress the synthetic click that fires right after pointerup, so
      // we don't accidentally open/close the panel just by releasing.
      const killClick = (ev: Event) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      window.addEventListener('click', killClick, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', killClick, true), 80);

      const el = elRef.current;
      const home = getHomeAbs();
      if (el) {
        const rect = el.getBoundingClientRect();
        const dist = Math.hypot(rect.left - home.left, rect.top - home.top);
        if (dist < SNAP_DISTANCE) {
          // Slide left/top toward home, then flip the anchor.
          setView({ mode: 'snapping-home', left: home.left, top: home.top });
          window.setTimeout(
            () => setView({ mode: 'home-static' }),
            SNAP_DURATION_MS,
          );
          return;
        }
      }
      // Dropped outside snap range — stay where the user put it.
      setView((prev) =>
        prev.mode === 'free'
          ? { mode: 'free', left: prev.left, top: prev.top, nearHome: false }
          : prev,
      );
    },
    [getHomeAbs],
  );

  // Keep the refs to handlers fresh so the once-listener can find them.
  moveRef.current = onPointerMoveWindow;
  upRef.current = onPointerUpWindow;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const el = elRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startLeft: rect.left,
      startTop: rect.top,
      isDragging: false,
    };
    window.addEventListener('pointermove', moveRef.current);
    window.addEventListener('pointerup', upRef.current, { once: true });
  };

  const baseStyle: React.CSSProperties = {
    position: 'fixed',
    pointerEvents: 'auto',
    touchAction: 'none',
  };

  let style: React.CSSProperties;
  if (view.mode === 'home-static') {
    style = { ...baseStyle, right: HOME_MARGIN, bottom: HOME_MARGIN };
  } else if (view.mode === 'free') {
    style = { ...baseStyle, left: view.left, top: view.top };
  } else {
    style = {
      ...baseStyle,
      left: view.left,
      top: view.top,
      transition: `left ${SNAP_DURATION_MS}ms ${SNAP_EASE}, top ${SNAP_DURATION_MS}ms ${SNAP_EASE}`,
    };
  }

  const cls = [
    'gl-floater',
    dragRef.current?.isDragging ? 'gl-floater-dragging' : '',
    view.nearHome ? 'gl-floater-near-home' : '',
    view.mode === 'snapping-home' ? 'gl-floater-snapping' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={elRef}
      className={cls}
      style={style}
      onPointerDown={onPointerDown}
    >
      {children}
    </div>
  );
}
