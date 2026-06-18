import { useCallback, useRef, useState } from 'react';

/**
 * Shared open-state + placement logic for the floating cards' info panels.
 *
 * The panel is absolutely positioned relative to the pill, so on open we pick a
 * direction that keeps it on-screen:
 *  - opens UP when there isn't room below (e.g. the pill is near the bottom,
 *    including its bottom-right home), and
 *  - anchors to the LEFT edge when the pill sits in the left half of the screen,
 *    otherwise to the right edge.
 */

// Rough panel height; we only need to know whether it comfortably fits below.
const PANEL_EST_H = 380;

export function usePanel() {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const [anchorLeft, setAnchorLeft] = useState(false);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      if (prev) return false;
      const el = ref.current;
      if (el) {
        const r = el.getBoundingClientRect();
        const spaceBelow = window.innerHeight - r.bottom;
        const spaceAbove = r.top;
        setOpenUp(spaceBelow < PANEL_EST_H && spaceAbove > spaceBelow);
        setAnchorLeft(r.left + r.width / 2 < window.innerWidth / 2);
      }
      return true;
    });
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const cardClass = `gl-card${openUp ? ' gl-open-up' : ''}${anchorLeft ? ' gl-anchor-left' : ''}`;

  return { open, toggle, close, ref, cardClass };
}
