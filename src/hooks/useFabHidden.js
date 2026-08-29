import { useState, useEffect } from "react";

/**
 * The FAB gets out of the way while you're reading down the page and comes
 * back the moment you scroll up. Most of what it floats over is prose, and a
 * button parked over the middle of a sentence is worse than one you have to
 * flick to recover.
 *
 * Extracted out of App.jsx so every page's FAB (Shelf, Echo, ...) shares the
 * exact same scroll behaviour rather than each page re-deriving its own —
 * that drift is exactly how Echo's FAB ended up not hiding at all.
 */
export default function useFabHidden() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      // rAF-coalesced: scroll fires far faster than we can usefully react to.
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - last;
        // Near the top there is nothing to read past yet, so the button stays.
        // The 6px threshold ignores jitter and iOS rubber-banding, which would
        // otherwise flicker the FAB at the ends of the page.
        if (y <= 120) setHidden(false);
        else if (Math.abs(dy) > 6) setHidden(dy > 0);
        last = y;
        queued = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return hidden;
}
