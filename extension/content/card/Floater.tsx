import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Draggable + snap-home wrapper for the in-page card.
 *
 * Three modes:
 *  - 'home-static'  → anchored bottom-right via right/bottom
 *  - 'free'         → anchored by left/top wherever the user dropped it
 *  - 'snapping-home'→ transient: animate left/top toward computed home coords,
 *                     then atomically swap to right/bottom when settled
 *
 * Why the swap dance: CSS can't transition between right/bottom and left/top,
 * so we measure home's actual viewport coordinates at snap time, animate
 * left/top into that exact spot, then flip the anchor back to right/bottom
 * after the transition completes. The visual is one seamless slide.
 *
 * Performance: while dragging we do NOT call setState per pointermove — that
 * re-renders the children (which include the animated Sonion SVG) on every
 * frame and tanks the FPS. Instead the drag writes left/top straight to the
 * DOM, throttled to one write per animation frame, and only commits to React
 * state once on release.
 *
 * The trigger button stays clickable: a drag is only detected after the pointer
 * crosses DRAG_THRESHOLD px. A plain tap bubbles through and the panel opens.
 * When `dragDisabled` is set (the panel is open) dragging is suppressed entirely
 * so an open card can't be flung around.
 */

const POS_KEY = 'greenlens.pillPos';
const HOME_MARGIN = 16;
const DRAG_THRESHOLD = 5;
const SNAP_DISTANCE = 140;
const SNAP_DURATION_MS = 480;
const SNAP_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
const EDGE = 4; // min gap from the viewport edge while dragging

type Stored = { kind: 'home' } | { kind: 'free'; left: number; top: number };

type Mode = 'home-static' | 'free' | 'snapping-home';

interface ViewState {
  mode: Mode;
  left?: number;
  top?: number;
}

interface DragState {
  startX: number;
  startY: number;
  startLeft: number;
  startTop: number;
  curLeft: number;
  curTop: number;
  near: boolean;
  isDragging: boolean;
  raf: number | null;
}

interface Props {
  children: React.ReactNode;
  /** Fires once per drag when the pointer crosses the drag threshold. Lets the
   *  parent close any open panel so it doesn't fly around mid-grab. */
  onDragStart?: () => void;
  /** When true (e.g. the info panel is open) the floater can't be dragged. */
  dragDisabled?: boolean;
}

export function Floater({ children, onDragStart, dragDisabled = false }: Props) {
  const [view, setView] = useState<ViewState>({ mode: 'home-static' });
  const elRef = useRef<HTMLDivElement | null>(null);

  // Latest props behind refs so the window listeners stay stable and we never
  // need to re-render mid-drag to read fresh values.
  const onDragStartRef = useRef(onDragStart);
  onDragStartRef.current = onDragStart;
  const dragDisabledRef = useRef(dragDisabled);
  dragDisabledRef.current = dragDisabled;

  const dragRef = useRef<DragState | null>(null);

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
      const maxL = window.innerWidth - w - EDGE;
      const maxT = window.innerHeight - h - EDGE;
      const cl = Math.max(EDGE, Math.min(maxL, view.left ?? 0));
      const ct = Math.max(EDGE, Math.min(maxT, view.top ?? 0));
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

  // One DOM write per frame — coalesces the burst of pointermove events the
  // browser can fire between paints.
  const flushPosition = useCallback(() => {
    const d = dragRef.current;
    if (!d) return;
    d.raf = null;
    const el = elRef.current;
    if (!el) return;
    el.style.left = `${d.curLeft}px`;
    el.style.top = `${d.curTop}px`;
    el.classList.toggle('gl-floater-near-home', d.near);
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
        onDragStartRef.current?.();
        const el = elRef.current;
        if (el) {
          // Detach from the bottom-right home anchor onto absolute left/top so
          // the pill can move freely, and switch on the grab affordance.
          el.style.right = 'auto';
          el.style.bottom = 'auto';
          el.style.left = `${d.startLeft}px`;
          el.style.top = `${d.startTop}px`;
          el.classList.add('gl-floater-dragging');
        }
      }
      e.preventDefault();
      const el = elRef.current;
      const w = el?.offsetWidth ?? 200;
      const h = el?.offsetHeight ?? 80;
      d.curLeft = Math.max(EDGE, Math.min(window.innerWidth - w - EDGE, d.startLeft + dx));
      d.curTop = Math.max(EDGE, Math.min(window.innerHeight - h - EDGE, d.startTop + dy));
      const home = getHomeAbs();
      d.near = Math.hypot(d.curLeft - home.left, d.curTop - home.top) < SNAP_DISTANCE;
      if (d.raf == null) d.raf = requestAnimationFrame(flushPosition);
    },
    [getHomeAbs, flushPosition],
  );

  const onPointerUpWindow = useCallback(
    (_e: PointerEvent) => {
      const d = dragRef.current;
      dragRef.current = null;
      window.removeEventListener('pointermove', onPointerMoveWindow);
      if (!d) return;
      if (d.raf != null) cancelAnimationFrame(d.raf);
      if (!d.isDragging) return; // a tap — let the click through to toggle

      // Suppress the click synthesized right after pointerup, so releasing a
      // drag doesn't also toggle the panel.
      const killClick = (ev: Event) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      window.addEventListener('click', killClick, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', killClick, true), 80);

      const home = getHomeAbs();
      const dist = Math.hypot(d.curLeft - home.left, d.curTop - home.top);
      if (dist < SNAP_DISTANCE) {
        // Slide left/top toward home, then flip the anchor back to right/bottom.
        setView({ mode: 'snapping-home', left: home.left, top: home.top });
        window.setTimeout(() => setView({ mode: 'home-static' }), SNAP_DURATION_MS);
        return;
      }
      // Dropped outside snap range — commit wherever the user put it.
      setView({ mode: 'free', left: d.curLeft, top: d.curTop });
    },
    [getHomeAbs, onPointerMoveWindow],
  );

  // Tear down any in-flight drag on unmount.
  useEffect(() => {
    return () => {
      const d = dragRef.current;
      if (d?.raf != null) cancelAnimationFrame(d.raf);
      window.removeEventListener('pointermove', onPointerMoveWindow);
      window.removeEventListener('pointerup', onPointerUpWindow);
    };
  }, [onPointerMoveWindow, onPointerUpWindow]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (dragDisabledRef.current) return; // panel open → no dragging
    const el = elRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startLeft: rect.left,
      startTop: rect.top,
      curLeft: rect.left,
      curTop: rect.top,
      near: false,
      isDragging: false,
      raf: null,
    };
    window.addEventListener('pointermove', onPointerMoveWindow);
    window.addEventListener('pointerup', onPointerUpWindow, { once: true });
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

  // Drag-only classes (dragging / near-home) are toggled imperatively during a
  // drag; here we only set the classes that depend on React state/props.
  const cls = [
    'gl-floater',
    view.mode === 'snapping-home' ? 'gl-floater-snapping' : '',
    dragDisabled ? 'gl-floater-locked' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={elRef} className={cls} style={style} onPointerDown={onPointerDown}>
      {children}
    </div>
  );
}
