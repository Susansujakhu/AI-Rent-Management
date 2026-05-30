"use client";

import { useEffect, type RefObject } from "react";

// Keeps absolutely-positioned popovers within the viewport. After the panel
// opens, measures its rect; if it overflows left or right of the viewport,
// applies a translateX so it slides back into view. Useful on narrow mobile
// screens where left-anchored popovers can spill off the right edge, or
// right-anchored ones off the left.
export function useClampPopover(open: boolean, panelRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    panel.style.transform = "";
    const id = requestAnimationFrame(() => {
      const rect = panel.getBoundingClientRect();
      const pad  = 8;
      let shift = 0;
      if (rect.right > window.innerWidth - pad) {
        shift = -(rect.right - (window.innerWidth - pad));
      } else if (rect.left < pad) {
        shift = pad - rect.left;
      }
      if (shift !== 0) {
        panel.style.transform = `translateX(${shift}px)`;
      }
    });
    return () => cancelAnimationFrame(id);
  }, [open, panelRef]);
}
